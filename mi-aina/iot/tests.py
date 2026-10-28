import json
import uuid
from django.contrib.auth.hashers import make_password
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from accounts.models import Compte
from consultations.models import Consultation
from csb.models import CSB
from iot.models import Device, Measure
from patients.models import Patient


class DeviceMeasurementApiTests(TestCase):
    def setUp(self):
        self.csb = CSB.objects.create(
            code='CSB-IOT-1', nom='CSB IoT', district='District', region='Région')
        self.agent = Compte.objects.create_user(
            'PREMIERE_LIGNE', 'MG-T-IOT1', 'Test-password-123',
            nom='Agent', prenom='Test', statut='ACTIF', csb=self.csb)
        self.patient = Patient.objects.create(
            nom='Patient', sexe='F', agent_referent=self.agent, csb=self.csb)
        self.consultation = Consultation.objects.create(
            patient=self.patient, premiere_ligne=self.agent,
            motif='Test capteurs', statut='EN_COURS')
        self.token = 'one-time-device-secret-for-tests'
        self.device = Device.objects.create(
            code='MI-AINA-ESP32-001', nom='Boîtier test', csb=self.csb,
            assigne_a=self.agent, token_hash=make_password(self.token))
        self.url = reverse('iot_measure_receive')

    def payload(self, **overrides):
        data = {
            'device_id': self.device.code,
            'consultation_id': self.consultation.pk,
            'event_id': str(uuid.uuid4()),
            'timestamp': timezone.now().isoformat(),
            'temperature': 36.8,
            'ecg': 2048,
            'electrodes_connected': True,
        }
        data.update(overrides)
        return data

    def post_payload(self, data, token=None):
        headers = {'HTTP_AUTHORIZATION': f'Bearer {token or self.token}'}
        return self.client.post(self.url, data=json.dumps(data), content_type='application/json', **headers)

    def test_valid_temperature_and_ecg_are_saved_to_consultation_patient(self):
        response = self.post_payload(self.payload())
        self.assertEqual(response.status_code, 201)
        measure = Measure.objects.get()
        self.assertEqual(measure.patient, self.patient)
        self.assertEqual(measure.consultation, self.consultation)
        self.assertEqual(str(measure.temperature), '36.8')
        self.assertEqual(measure.ecg_brut, 2048)
        self.assertTrue(measure.electrodes_connectees)
        self.assertTrue(measure.synchronise)
        self.assertIsNone(measure.bpm)
        self.device.refresh_from_db()
        self.assertEqual(self.device.statut, 'CONNECTÉ')
        self.assertIsNotNone(self.device.derniere_communication)
        self.assertIsNone(response.json()['heart_rate_bpm'])

    def test_unknown_device_is_rejected(self):
        response = self.post_payload(self.payload(device_id='UNKNOWN-ESP32'))
        self.assertEqual(response.status_code, 404)
        self.assertFalse(Measure.objects.exists())

    def test_wrong_device_token_is_rejected(self):
        response = self.post_payload(self.payload(), token='wrong-token')
        self.assertEqual(response.status_code, 401)
        self.assertFalse(Measure.objects.exists())

    def test_temperature_out_of_range_is_rejected(self):
        response = self.post_payload(self.payload(temperature=55.0))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Measure.objects.exists())

    def test_ecg_only_is_saved_without_inventing_heart_rate(self):
        response = self.post_payload(self.payload(temperature=None))
        self.assertEqual(response.status_code, 201)
        measure = Measure.objects.get()
        self.assertIsNone(measure.temperature)
        self.assertEqual(measure.ecg_brut, 2048)
        self.assertIsNone(measure.bpm)
        self.assertEqual(response.json()['heart_rate_status'], 'non calculée')

    def test_invalid_ecg_value_is_rejected(self):
        response = self.post_payload(self.payload(ecg=5000))
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Measure.objects.exists())

    def test_unknown_consultation_is_rejected(self):
        response = self.post_payload(self.payload(consultation_id=999999))
        self.assertEqual(response.status_code, 404)
        self.assertFalse(Measure.objects.exists())

    def test_device_cannot_send_for_another_agents_consultation(self):
        other_agent = Compte.objects.create_user(
            'PREMIERE_LIGNE', 'MG-T-IOT2', 'Test-password-123',
            nom='Autre', prenom='Agent', statut='ACTIF', csb=self.csb)
        other_patient = Patient.objects.create(
            nom='Autre patient', sexe='M', agent_referent=other_agent, csb=self.csb)
        other_consultation = Consultation.objects.create(
            patient=other_patient, premiere_ligne=other_agent,
            motif='Autre consultation', statut='EN_COURS')
        response = self.post_payload(self.payload(consultation_id=other_consultation.pk))
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Measure.objects.exists())

    def test_same_event_can_be_retried_without_creating_duplicate(self):
        data = self.payload()
        first = self.post_payload(data)
        second = self.post_payload(data)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.json()['duplicate'])
        self.assertEqual(Measure.objects.count(), 1)

    def test_device_can_be_disabled(self):
        self.device.actif = False
        self.device.save(update_fields=['actif'])
        response = self.post_payload(self.payload())
        self.assertEqual(response.status_code, 403)
        self.assertFalse(Measure.objects.exists())

    def test_terminal_consultation_is_rejected(self):
        self.consultation.statut = 'TERMINEE'
        self.consultation.save(update_fields=['statut'])
        response = self.post_payload(self.payload())
        self.assertEqual(response.status_code, 409)
        self.assertFalse(Measure.objects.exists())


class SimulationMeasurementApiTests(TestCase):
    def setUp(self):
        self.csb = CSB.objects.create(
            code='CSB-SIM-1', nom='CSB simulation', district='District', region='Région')
        self.agent = Compte.objects.create_user(
            'PREMIERE_LIGNE', 'MG-T-SIM1', 'Test-password-123',
            nom='Agent', prenom='Démo', statut='ACTIF', csb=self.csb)
        self.patient = Patient.objects.create(
            nom='Patient démo', sexe='F', agent_referent=self.agent, csb=self.csb)
        self.consultation = Consultation.objects.create(
            patient=self.patient, premiere_ligne=self.agent,
            motif='Test simulation', statut='EN_COURS')
        self.client.force_login(self.agent)
        self.url = reverse('iot_measure_simulation')

    def simulation_payload(self, **overrides):
        data = {
            'consultation_id': self.consultation.pk,
            'event_id': str(uuid.uuid4()),
            'timestamp': timezone.now().isoformat(),
            'temperature': 36.7,
            'bpm': 72,
        }
        data.update(overrides)
        return data

    def post_simulation(self, data):
        return self.client.post(self.url, data=json.dumps(data), content_type='application/json')

    def test_valid_demo_temperature_and_pulse_are_stored_without_ecg(self):
        response = self.post_simulation(self.simulation_payload())
        self.assertEqual(response.status_code, 201)
        measure = Measure.objects.get()
        self.assertEqual(measure.source, 'SIMULATION')
        self.assertEqual(measure.bpm, 72)
        self.assertIsNone(measure.ecg_signal)
        self.assertIsNone(measure.ecg_brut)
        self.assertEqual(measure.consultation, self.consultation)
        self.assertTrue(measure.device.is_simulated)
        self.assertEqual(measure.device.statut, 'HORS LIGNE')
        self.assertEqual(measure.device, Device.objects.get(is_simulated=True))

    def test_simulation_rejects_invalid_temperature_bpm_and_ecg(self):
        for values in ({'temperature': 44}, {'bpm': 120}, {'ecg_samples': [5000] * 64}):
            with self.subTest(values=values):
                response = self.post_simulation(self.simulation_payload(**values))
                self.assertEqual(response.status_code, 400)
        self.assertFalse(Measure.objects.exists())

    def test_simulation_rejects_missing_or_other_agent_consultation(self):
        missing = self.post_simulation(self.simulation_payload(consultation_id=999999))
        self.assertEqual(missing.status_code, 404)
        other_agent = Compte.objects.create_user(
            'PREMIERE_LIGNE', 'MG-T-SIM-2', 'Test-password-123',
            nom='Autre', prenom='Agent', statut='ACTIF', csb=self.csb)
        other_patient = Patient.objects.create(
            nom='Autre patient', sexe='M', agent_referent=other_agent, csb=self.csb)
        other_consult = Consultation.objects.create(
            patient=other_patient, premiere_ligne=other_agent, motif='Autre')
        forbidden = self.post_simulation(self.simulation_payload(consultation_id=other_consult.pk))
        self.assertEqual(forbidden.status_code, 403)
        self.assertFalse(Measure.objects.exists())

    def test_simulation_requires_authenticated_first_line_agent(self):
        self.client.logout()
        response = self.post_simulation(self.simulation_payload())
        self.assertEqual(response.status_code, 302)
        self.assertFalse(Measure.objects.exists())

    def test_simulation_event_retry_is_idempotent(self):
        payload = self.simulation_payload()
        first = self.post_simulation(payload)
        second = self.post_simulation(payload)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(second.json()['duplicate'])
        self.assertEqual(Measure.objects.count(), 1)

    @override_settings(IOT_SIMULATION_ENABLED=False)
    def test_simulation_can_be_disabled(self):
        response = self.post_simulation(self.simulation_payload())
        self.assertEqual(response.status_code, 404)
        self.assertFalse(Measure.objects.exists())
