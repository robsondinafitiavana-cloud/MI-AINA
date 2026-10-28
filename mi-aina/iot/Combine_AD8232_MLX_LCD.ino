#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <Wire.h>
#include <Adafruit_MLX90614.h>
#include <LiquidCrystal_I2C.h>
#include <esp_timer.h>
#include <esp_system.h>
#include <time.h>
#include <math.h>
#include <string.h>

// Renseigner ces valeurs avant téléversement. L'identifiant doit correspondre
// exactement au champ Device.code dans MI-AINA; ne pas publier le jeton.
const char* WIFI_SSID = "WIFI_POINT_ACCES";
const char* WIFI_PASSWORD = "MOT_DE_PASSE";
const char* DJANGO_URL = "http://192.168.16.113:8000/iot/measures/";
const char* DEVICE_CODE = "#14";
const char* IOT_API_TOKEN = "REMPLACER_PAR_LE_JETON_PROVISIONNE_DANS_DJANGO";
// La consultation doit déjà exister dans MI-AINA. Renseigner son identifiant.
const char* CONSULTATION_ID = "REMPLACER_PAR_ID_CONSULTATION";

// Câblage du fichier fourni : écran sur Wire, MLX90614 sur Wire1.
constexpr uint8_t LCD_SDA_PIN = 18;
constexpr uint8_t LCD_SCL_PIN = 19;
constexpr uint8_t MLX_SDA_PIN = 21;
constexpr uint8_t MLX_SCL_PIN = 22;
constexpr uint8_t LCD_ADDRESS = 0x27;

constexpr uint8_t ECG_OUTPUT_PIN = 34;
constexpr uint8_t LEAD_OFF_PLUS_PIN = 32;
constexpr uint8_t LEAD_OFF_MINUS_PIN = 33;

constexpr uint32_t ECG_SAMPLE_RATE_HZ = 250;
constexpr uint32_t ECG_SAMPLE_INTERVAL_US = 1000000UL / ECG_SAMPLE_RATE_HZ;
constexpr uint32_t TEMPERATURE_INTERVAL_MS = 1000;
constexpr uint32_t WIFI_RETRY_INTERVAL_MS = 10000;
constexpr uint32_t HTTP_SEND_INTERVAL_MS = 5000;
constexpr uint32_t LCD_REFRESH_INTERVAL_MS = 1000;

Adafruit_MLX90614 mlx90614;
LiquidCrystal_I2C lcd(LCD_ADDRESS, 16, 2);

unsigned long lastTemperatureReadMs = 0;
unsigned long lastWifiAttemptMs = 0;
unsigned long lastCaptureMs = 0;
unsigned long lastHttpSendMs = 0;
unsigned long lastLcdRefreshMs = 0;
unsigned long lastConfigWarningMs = 0;
bool wifiAttempted = false;
bool clockConfigured = false;
bool mlxAvailable = false;
bool objectTemperatureValid = false;
float objectTemperatureC = 0.0f;
volatile int ecgValue = 0;
volatile bool leadOffPlus = true;
volatile bool leadOffMinus = true;
portMUX_TYPE ecgMux = portMUX_INITIALIZER_UNLOCKED;
TaskHandle_t ecgTaskHandle = nullptr;
esp_timer_handle_t ecgSampleTimer = nullptr;

// Un relevé en attente reste en RAM et garde le même event_id lors des renvois.
// Cette file à un élément n'est pas persistante après une coupure d'alimentation.
String pendingPayload;
bool pendingPayloadReady = false;
uint8_t lcdPage = 0;

bool validConfiguration() {
  return strcmp(WIFI_SSID, "WIFI_POINT_ACCES") != 0 &&
         strcmp(WIFI_PASSWORD, "MOT_DE_PASSE") != 0 &&
         strcmp(IOT_API_TOKEN, "REMPLACER_PAR_LE_JETON_PROVISIONNE_DANS_DJANGO") != 0 &&
         strcmp(CONSULTATION_ID, "REMPLACER_PAR_ID_CONSULTATION") != 0 &&
         strlen(DEVICE_CODE) > 0;
}

void acquisitionEcgTask(void* parameter) {
  while (true) {
    ulTaskNotifyTake(pdTRUE, portMAX_DELAY);
    const bool plusOff = digitalRead(LEAD_OFF_PLUS_PIN) == HIGH;
    const bool minusOff = digitalRead(LEAD_OFF_MINUS_PIN) == HIGH;
    const int sample = (!plusOff && !minusOff) ? analogRead(ECG_OUTPUT_PIN) : 0;

    portENTER_CRITICAL(&ecgMux);
    ecgValue = sample;
    leadOffPlus = plusOff;
    leadOffMinus = minusOff;
    portEXIT_CRITICAL(&ecgMux);
  }
}

void ecgTimerCallback(void* parameter) {
  if (ecgTaskHandle != nullptr) xTaskNotifyGive(ecgTaskHandle);
}

void startWifiConnection() {
  if (WiFi.status() == WL_CONNECTED ||
      (wifiAttempted && millis() - lastWifiAttemptMs < WIFI_RETRY_INTERVAL_MS)) return;

  wifiAttempted = true;
  lastWifiAttemptMs = millis();
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.println("Tentative de connexion Wi-Fi...");
}

void readTemperature() {
  if (millis() - lastTemperatureReadMs < TEMPERATURE_INTERVAL_MS) return;
  lastTemperatureReadMs = millis();
  if (!mlxAvailable) {
    objectTemperatureValid = false;
    return;
  }

  const float value = mlx90614.readObjectTempC();
  // La même plage de validation est appliquée par l'API Django.
  objectTemperatureValid = isfinite(value) && value >= 25.0f && value <= 45.0f;
  if (objectTemperatureValid) objectTemperatureC = value;
}

bool makeEventId(char* output, size_t outputSize) {
  if (outputSize < 37) return false;
  uint8_t bytes[16];
  esp_fill_random(bytes, sizeof(bytes));
  bytes[6] = (bytes[6] & 0x0F) | 0x40;  // UUID version 4
  bytes[8] = (bytes[8] & 0x3F) | 0x80;
  snprintf(output, outputSize,
    "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
    static_cast<unsigned>(bytes[0]), static_cast<unsigned>(bytes[1]),
    static_cast<unsigned>(bytes[2]), static_cast<unsigned>(bytes[3]),
    static_cast<unsigned>(bytes[4]), static_cast<unsigned>(bytes[5]),
    static_cast<unsigned>(bytes[6]), static_cast<unsigned>(bytes[7]),
    static_cast<unsigned>(bytes[8]), static_cast<unsigned>(bytes[9]),
    static_cast<unsigned>(bytes[10]), static_cast<unsigned>(bytes[11]),
    static_cast<unsigned>(bytes[12]), static_cast<unsigned>(bytes[13]),
    static_cast<unsigned>(bytes[14]), static_cast<unsigned>(bytes[15]));
  return true;
}

String utcTimestampOrEmpty() {
  const time_t now = time(nullptr);
  if (now < 1700000000) return "";  // NTP pas encore synchronisé.
  struct tm utc;
  gmtime_r(&now, &utc);
  char timestamp[25];
  strftime(timestamp, sizeof(timestamp), "%Y-%m-%dT%H:%M:%SZ", &utc);
  return String(timestamp);
}

bool preparePendingPayload() {
  int currentEcg;
  bool plusOff;
  bool minusOff;
  portENTER_CRITICAL(&ecgMux);
  currentEcg = ecgValue;
  plusOff = leadOffPlus;
  minusOff = leadOffMinus;
  portEXIT_CRITICAL(&ecgMux);

  const bool electrodesConnected = !plusOff && !minusOff;
  const bool ecgValid = electrodesConnected;
  if (!objectTemperatureValid && !ecgValid) {
    Serial.println("Relevé ignoré : température invalide et électrodes déconnectées.");
    return false;
  }

  char eventId[37];
  if (!makeEventId(eventId, sizeof(eventId))) return false;
  const String timestamp = utcTimestampOrEmpty();

  pendingPayload = "{\"device_id\":\"" + String(DEVICE_CODE) +
    "\",\"consultation_id\":\"" + String(CONSULTATION_ID) +
    "\",\"event_id\":\"" + String(eventId) + "\"";
  if (timestamp.length()) pendingPayload += ",\"timestamp\":\"" + timestamp + "\"";
  pendingPayload += ",\"temperature\":";
  pendingPayload += objectTemperatureValid ? String(objectTemperatureC, 1) : String("null");
  pendingPayload += ",\"ecg\":";
  pendingPayload += ecgValid ? String(currentEcg) : String("null");
  pendingPayload += ",\"electrodes_connected\":";
  pendingPayload += electrodesConnected ? "true}" : "false}";
  pendingPayloadReady = true;
  return true;
}

void sendToDjango() {
  if (!validConfiguration()) {
    if (millis() - lastConfigWarningMs >= 5000) {
      lastConfigWarningMs = millis();
      Serial.println("Configuration requise : Wi-Fi, jeton, code boîtier et consultation.");
    }
    return;
  }

  const unsigned long now = millis();
  if (!pendingPayloadReady && now - lastCaptureMs >= HTTP_SEND_INTERVAL_MS) {
    lastCaptureMs = now;
    preparePendingPayload();
  }
  if (!pendingPayloadReady || WiFi.status() != WL_CONNECTED ||
      now - lastHttpSendMs < HTTP_SEND_INTERVAL_MS) return;
  lastHttpSendMs = now;

  HTTPClient http;
  http.setConnectTimeout(3000);
  http.setTimeout(5000);
  if (!http.begin(DJANGO_URL)) {
    Serial.println("Erreur : URL Django invalide.");
    return;
  }

  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + IOT_API_TOKEN);
  const int responseCode = http.POST(pendingPayload);
  Serial.printf("POST Django : HTTP %d\n", responseCode);
  if (responseCode > 0) Serial.println(http.getString());
  else Serial.println(http.errorToString(responseCode));
  http.end();

  if (responseCode == 200 || responseCode == 201) {
    pendingPayloadReady = false;
    pendingPayload = "";
  }
  // Sur erreur, le même event_id et le même JSON seront renvoyés plus tard.
}

void updateLcd() {
  if (millis() - lastLcdRefreshMs < LCD_REFRESH_INTERVAL_MS) return;
  lastLcdRefreshMs = millis();
  lcdPage = (lcdPage + 1) % 2;

  int currentEcg;
  bool plusOff;
  bool minusOff;
  portENTER_CRITICAL(&ecgMux);
  currentEcg = ecgValue;
  plusOff = leadOffPlus;
  minusOff = leadOffMinus;
  portEXIT_CRITICAL(&ecgMux);

  lcd.setCursor(0, 0);
  if (lcdPage == 0) {
    char line[17];
    snprintf(line, sizeof(line), "ECG:%4d %s", currentEcg,
      (!plusOff && !minusOff) ? "OK" : "LO");
    lcd.print(line);
    lcd.print("   ");
    lcd.setCursor(0, 1);
    lcd.print(WiFi.status() == WL_CONNECTED ? "Wi-Fi connecte  " : "Wi-Fi absent    ");
  } else {
    lcd.print("Temperature     ");
    lcd.setCursor(0, 1);
    if (objectTemperatureValid) {
      lcd.print("Objet: ");
      lcd.print(objectTemperatureC, 1);
      lcd.print((char)223);
      lcd.print("C       ");
    } else {
      lcd.print(mlxAvailable ? "Temp. invalide  " : "MLX90614 absent ");
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(ECG_OUTPUT_PIN, INPUT);
  pinMode(LEAD_OFF_PLUS_PIN, INPUT);
  pinMode(LEAD_OFF_MINUS_PIN, INPUT);
  analogReadResolution(12);
  analogSetPinAttenuation(ECG_OUTPUT_PIN, ADC_11db);

  Wire.begin(LCD_SDA_PIN, LCD_SCL_PIN);
  Wire1.begin(MLX_SDA_PIN, MLX_SCL_PIN);
  Wire1.setClock(100000);
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("MI-AINA ESP32   ");
  lcd.setCursor(0, 1);
  lcd.print("Demarrage...    ");

  mlxAvailable = mlx90614.begin(0x5A, &Wire1);
  Serial.println(mlxAvailable
    ? "MLX90614 detecte sur Wire1 (GPIO21/22)."
    : "MLX90614 non detecte sur Wire1 (GPIO21/22).");

  const BaseType_t taskCreated = xTaskCreatePinnedToCore(
    acquisitionEcgTask, "ECG acquisition", 2048, nullptr, 2,
    &ecgTaskHandle, 1);
  if (taskCreated == pdPASS) {
    esp_timer_create_args_t timerConfig = {};
    timerConfig.callback = ecgTimerCallback;
    timerConfig.name = "ecg_sample";
    if (esp_timer_create(&timerConfig, &ecgSampleTimer) == ESP_OK) {
      esp_timer_start_periodic(ecgSampleTimer, ECG_SAMPLE_INTERVAL_US);
    } else {
      Serial.println("Erreur : timer ECG non démarré.");
    }
  } else {
    Serial.println("Erreur : tâche ECG non démarrée.");
  }
  startWifiConnection();
}

void loop() {
  startWifiConnection();
  if (WiFi.status() == WL_CONNECTED && !clockConfigured) {
    configTime(0, 0, "pool.ntp.org", "time.nist.gov");
    clockConfigured = true;
  }
  readTemperature();
  updateLcd();
  sendToDjango();
  delay(1);
}
