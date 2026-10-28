#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include <LiquidCrystal_I2C.h>
#include <esp_timer.h>

// Remplacer par les identifiants du point d'acces Wi-Fi.
const char* WIFI_SSID = "WIFI_POINT_ACCES";
const char* WIFI_PASSWORD = "MOT_DE_PASSE";

// Cette route est visee par le robot, mais elle doit exister dans Django.
const char* DJANGO_URL = "http://192.168.16.113:8000/iot/measures/";

constexpr uint8_t ECG_OUTPUT_PIN = 34;
constexpr uint8_t LEAD_OFF_PLUS_PIN = 32;
constexpr uint8_t LEAD_OFF_MINUS_PIN = 33;

constexpr uint8_t I2C_SDA_PIN = 21;
constexpr uint8_t I2C_SCL_PIN = 22;
constexpr uint8_t LCD_ADDRESS = 0x27;  // Remplacer par 0x3F si necessaire.
constexpr uint8_t LCD_COLUMNS = 16;
constexpr uint8_t LCD_ROWS = 2;

constexpr uint32_t ECG_SAMPLE_INTERVAL_MS = 4;  // Environ 250 echantillons/s.
constexpr uint32_t LCD_REFRESH_INTERVAL_MS = 500;
constexpr uint32_t SENSOR_READ_INTERVAL_MS = 1000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
constexpr uint32_t HTTP_SEND_INTERVAL_MS = 5000;

Adafruit_MLX90614 mlx90614;
LiquidCrystal_I2C lcd(LCD_ADDRESS, LCD_COLUMNS, LCD_ROWS);

volatile int ecgValue = 0;
volatile bool leadOffPlus = true;
volatile bool leadOffMinus = true;
portMUX_TYPE ecgMux = portMUX_INITIALIZER_UNLOCKED;
TaskHandle_t ecgTaskHandle = nullptr;
esp_timer_handle_t ecgSampleTimer = nullptr;

bool mlxAvailable = false;
float objectTemperatureC = 0.0f;
float ambientTemperatureC = 0.0f;

unsigned long lastLcdRefresh = 0;
unsigned long lastSensorRead = 0;
unsigned long lastWifiAttempt = 0;
unsigned long lastHttpSend = 0;
uint8_t lcdPage = 0;

void acquisitionEcgTask(void* parameter) {
  while (true) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);

    const bool plusOff = digitalRead(LEAD_OFF_PLUS_PIN) == HIGH;
    const bool minusOff = digitalRead(LEAD_OFF_MINUS_PIN) == HIGH;
    const bool leadsConnected = !plusOff && !minusOff;
    const int sample = leadsConnected ? analogRead(ECG_OUTPUT_PIN) : 0;

    portENTER_CRITICAL(&ecgMux);
    ecgValue = sample;
    leadOffPlus = plusOff;
    leadOffMinus = minusOff;
    portEXIT_CRITICAL(&ecgMux);

  }
}

void ecgTimerCallback(void* parameter) {
  if (ecgTaskHandle != nullptr) {
    xTaskNotifyGive(ecgTaskHandle);
  }
}

void startWifiConnection() {
  if (WiFi.status() == WL_CONNECTED ||
      millis() - lastWifiAttempt < WIFI_RETRY_INTERVAL_MS) {
    return;
  }

  lastWifiAttempt = millis();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Tentative de connexion Wi-Fi...");
}

void readTemperature() {
  if (!mlxAvailable || millis() - lastSensorRead < SENSOR_READ_INTERVAL_MS) {
    return;
  }

  lastSensorRead = millis();
  objectTemperatureC = mlx90614.readObjectTempC();
  ambientTemperatureC = mlx90614.readAmbientTempC();
}

void updateLcd() {
  if (millis() - lastLcdRefresh < LCD_REFRESH_INTERVAL_MS) {
    return;
  }

  lastLcdRefresh = millis();
  lcdPage = (lcdPage + 1) % 2;

  int currentEcg;
  bool currentLeadOffPlus;
  bool currentLeadOffMinus;

  portENTER_CRITICAL(&ecgMux);
  currentEcg = ecgValue;
  currentLeadOffPlus = leadOffPlus;
  currentLeadOffMinus = leadOffMinus;
  portEXIT_CRITICAL(&ecgMux);

  lcd.clear();

  if (lcdPage == 0) {
    char line[LCD_COLUMNS + 1];
    const char* leadStatus = (currentLeadOffPlus || currentLeadOffMinus)
      ? "LO" : "OK";

    snprintf(line, sizeof(line), "ECG:%4d %s", currentEcg, leadStatus);
    lcd.setCursor(0, 0);
    lcd.print(line);
    lcd.setCursor(0, 1);

    if (mlxAvailable) {
      lcd.print("Objet:");
      lcd.print(objectTemperatureC, 1);
      lcd.print((char)223);
      lcd.print("C");
    } else {
      lcd.print("MLX absent");
    }
  } else {
    lcd.setCursor(0, 0);
    if (mlxAvailable) {
      lcd.print("Ambiant:");
      lcd.print(ambientTemperatureC, 1);
      lcd.print((char)223);
      lcd.print("C");
    } else {
      lcd.print("Temperature N/D");
    }

    lcd.setCursor(0, 1);
    lcd.print(WiFi.status() == WL_CONNECTED ? "Wi-Fi connecte" : "Wi-Fi absent");
  }
}

void sendToDjango() {
  if (WiFi.status() != WL_CONNECTED ||
      millis() - lastHttpSend < HTTP_SEND_INTERVAL_MS) {
    return;
  }

  lastHttpSend = millis();

  int currentEcg;
  bool currentLeadOffPlus;
  bool currentLeadOffMinus;

  portENTER_CRITICAL(&ecgMux);
  currentEcg = ecgValue;
  currentLeadOffPlus = leadOffPlus;
  currentLeadOffMinus = leadOffMinus;
  portEXIT_CRITICAL(&ecgMux);

  String payload = "{";
  payload += "\"ecg\":" + String(currentEcg) + ",";
  payload += "\"electrodes_connected\":";
  payload += (!currentLeadOffPlus && !currentLeadOffMinus) ? "true," : "false,";
  payload += "\"temperature\":";
  payload += mlxAvailable ? String(objectTemperatureC, 1) : "null";
  payload += ",\"ambient_temperature\":";
  payload += mlxAvailable ? String(ambientTemperatureC, 1) : "null";
  payload += "}";

  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(3000);

  if (!http.begin(DJANGO_URL)) {
    Serial.println("Erreur: URL Django invalide");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  const int responseCode = http.POST(payload);
  Serial.printf("POST Django: HTTP %d\n", responseCode);

  if (responseCode > 0) {
    Serial.println(http.getString());
  } else {
    Serial.println(http.errorToString(responseCode));
  }

  http.end();
}

void setup() {
  Serial.begin(115200);

  pinMode(ECG_OUTPUT_PIN, INPUT);
  pinMode(LEAD_OFF_PLUS_PIN, INPUT);
  pinMode(LEAD_OFF_MINUS_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(ECG_OUTPUT_PIN, ADC_11db);

  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("MI-AINA ESP32");
  lcd.setCursor(0, 1);
  lcd.print("Demarrage...");

  mlxAvailable = mlx90614.begin();
  Serial.println(mlxAvailable ? "MLX90614 pret" : "MLX90614 non detecte");

  const BaseType_t taskCreated = xTaskCreatePinnedToCore(
    acquisitionEcgTask,
    "ECG acquisition",
    2048,
    nullptr,
    2,
    &ecgTaskHandle,
    1
  );

  if (taskCreated == pdPASS) {
    esp_timer_create_args_t timerConfig = {};
    timerConfig.callback = ecgTimerCallback;
    timerConfig.name = "ecg_sample";
    if (esp_timer_create(&timerConfig, &ecgSampleTimer) == ESP_OK) {
      esp_timer_start_periodic(
        ecgSampleTimer,
        static_cast<uint64_t>(ECG_SAMPLE_INTERVAL_MS) * 1000ULL
      );
    } else {
      Serial.println("Erreur: timer ECG non demarre");
    }
  } else {
    Serial.println("Erreur: tache ECG non demarree");
  }

  startWifiConnection();
}

void loop() {
  startWifiConnection();
  readTemperature();
  updateLcd();
  sendToDjango();
  delay(1);
}