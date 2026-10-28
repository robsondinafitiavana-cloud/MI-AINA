from django.contrib.auth import get_user_model
from django.test import TestCase

from reports.models import Signalement

User = get_user_model()


class SignalementAnnulationTests(TestCase):
    def setUp(self):
        self.agent = User.objects.create_user(
            'PREMIERE_LIGNE', 'MAT-SIG-001', 'MotDePasse12345',
            nom='Rakoto', prenom='Soa', statut='ACTIF')
        self.autre_agent = User.objects.create_user(
            'PREMIERE_LIGNE', 'MAT-SIG-002', 'MotDePasse12345',
            nom='Rabe', prenom='Mialy', statut='ACTIF')
        self.signalement = Signalement.objects.create(
            type='Paludisme suspecté', village='Ampasimanjeva', nb_cas=2,
            agent=self.agent, statut='TRANSMIS')
        self.client.force_login(self.agent, backend='django.contrib.auth.backends.ModelBackend')

    def test_auteur_peut_annuler_un_signalement_transmis(self):
        response = self.client.post(f'/reports/{self.signalement.pk}/delete/', data='{}',
                                    content_type='application/json')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['ok'])
        self.signalement.refresh_from_db()
        self.assertEqual(self.signalement.statut, 'ANNULE')

    def test_signalement_annule_ne_peut_pas_etre_annule_une_seconde_fois(self):
        self.signalement.statut = 'ANNULE'
        self.signalement.save(update_fields=['statut'])
        response = self.client.post(f'/reports/{self.signalement.pk}/delete/', data='{}',
                                    content_type='application/json')
        self.assertEqual(response.status_code, 403)
        self.signalement.refresh_from_db()
        self.assertEqual(self.signalement.statut, 'ANNULE')

    def test_un_autre_agent_ne_peut_pas_annuler_le_signalement(self):
        self.client.force_login(self.autre_agent, backend='django.contrib.auth.backends.ModelBackend')
        response = self.client.post(f'/reports/{self.signalement.pk}/delete/', data='{}',
                                    content_type='application/json')
        self.assertEqual(response.status_code, 404)
        self.signalement.refresh_from_db()
        self.assertEqual(self.signalement.statut, 'TRANSMIS')
