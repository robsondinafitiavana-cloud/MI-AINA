# -*- coding: utf-8 -*-
"""Tests du module messagerie : fils agent<->médecin et fils inter-rôles (pilotage)."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from csb.models import CSB
from messaging.models import Fil, Message, MessageFil, Thread

User = get_user_model()


def make_user(role, identifiant, csb=None, **extra):
    extra.setdefault('nom', 'Rakoto')
    extra.setdefault('prenom', 'Soa')
    extra.setdefault('statut', 'ACTIF')
    return User.objects.create_user(role, identifiant, 'MotDePasse12345', csb=csb, **extra)


class FilsAgentMedecinTests(TestCase):
    def setUp(self):
        self.csb = CSB.objects.create(code='CSB-M1', nom='CSB Test', district='Antananarivo',
                                      region='Analamanga')
        self.agent = make_user('PREMIERE_LIGNE', 'MAT-M-001', self.csb)
        self.medecin = make_user('MEDECIN', 'ORD-M-001', self.csb)
        self.thread = Thread.objects.create(agent=self.agent, medecin=self.medecin)

    def login(self, u):
        self.client.force_login(u, backend='django.contrib.auth.backends.ModelBackend')

    def test_envoi_et_liste(self):
        self.login(self.agent)
        r = self.client.post('/messaging/%d/send/' % self.thread.pk, {'texte': 'Tazo 39°'})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['ok'])
        self.assertEqual(Message.objects.count(), 1)

    def test_envoi_reserve_aux_participants(self):
        autre = make_user('MEDECIN', 'ORD-M-003', self.csb)
        self.login(autre)
        r = self.client.post('/messaging/%d/send/' % self.thread.pk, {'texte': 'intrusion'})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(Message.objects.count(), 0)

    def test_liste_reservee_aux_participants(self):
        autre = make_user('MEDECIN', 'ORD-M-002', self.csb)
        self.login(autre)
        r = self.client.get('/messaging/%d/messages/' % self.thread.pk)
        self.assertEqual(r.status_code, 403)

    def test_suppression_par_l_auteur_uniquement(self):
        m = Message.objects.create(thread=self.thread, sender=self.agent, texte='A supprimer')
        self.login(self.medecin)
        self.assertEqual(self.client.post('/messaging/message/%d/delete/' % m.pk).status_code, 403)
        self.login(self.agent)
        self.assertEqual(self.client.post('/messaging/message/%d/delete/' % m.pk).status_code, 200)
        m.refresh_from_db()
        self.assertTrue(m.supprime)


class FilsInterRolesTests(TestCase):
    def setUp(self):
        self.csb = CSB.objects.create(code='CSB-M2', nom='CSB Test', district='Antananarivo',
                                      region='Analamanga')
        self.pilot = make_user('PILOTAGE', 'pilote@test.mg', direction='Administration nationale')
        self.medecin = make_user('MEDECIN', 'ORD-M-010', self.csb)
        self.agent = make_user('PREMIERE_LIGNE', 'MAT-M-010', self.csb)

    def login(self, u):
        self.client.force_login(u, backend='django.contrib.auth.backends.ModelBackend')

    def test_pilotage_ouvre_un_fil_avec_un_medecin(self):
        self.login(self.pilot)
        r = self.client.post('/messaging/fils/creer/', {'dest': str(self.medecin.pk)})
        self.assertEqual(r.status_code, 200)
        data = r.json()
        self.assertTrue(data['ok'])
        self.assertEqual(Fil.objects.count(), 1)
        self.assertIn(self.medecin.nom, data['fil']['nom'])

    def test_pilotage_recherche_par_district_et_cree_un_fil_groupe(self):
        agent = self.agent
        self.login(self.pilot)
        r = self.client.get('/messaging/fils/annuaire/', {'q': self.csb.district})
        self.assertEqual(r.status_code, 200)
        self.assertEqual({item['id'] for item in r.json()['items']},
                         {str(self.medecin.pk), str(agent.pk)})
        r = self.client.post('/messaging/fils/creer/', {
            'destinataires': [str(self.medecin.pk), str(agent.pk)]})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Fil.objects.get().participants.count(), 3)

    def test_agent_cree_un_fil_depuis_l_annuaire_medecins(self):
        self.login(self.agent)
        r = self.client.post('/messaging/thread/create/', {'medecin_id': self.medecin.pk})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(Thread.objects.filter(agent=self.agent, medecin=self.medecin).exists())

    def test_pilotage_ecrit_et_le_medecin_lit(self):
        f = Fil.objects.create(titre='Consigne nationale')
        f.participants.add(self.pilot, self.medecin)
        self.login(self.pilot)
        r = self.client.post('/messaging/fils/%d/send/' % f.pk, {'texte': 'Rapport hebdomadaire requis'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(MessageFil.objects.count(), 1)
        self.login(self.medecin)
        r = self.client.get('/messaging/fils/%d/messages/' % f.pk)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['items'][0]['texte'], 'Rapport hebdomadaire requis')
        self.assertFalse(r.json()['items'][0]['me'])

    def test_fil_inaccessible_aux_non_participants(self):
        f = Fil.objects.create(titre='Privé')
        f.participants.add(self.pilot, self.medecin)
        self.login(self.agent)
        self.assertEqual(self.client.get('/messaging/fils/%d/messages/' % f.pk).status_code, 403)
        self.assertEqual(self.client.post('/messaging/fils/%d/send/' % f.pk,
                                          {'texte': 'intrusion'}).status_code, 403)

    def test_annuaire_inter_roles(self):
        self.login(self.pilot)
        r = self.client.get('/messaging/fils/annuaire/', {'q': 'Rakoto'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.json()['items']), 2)

    def test_liste_des_fils_et_compteur_non_lus(self):
        f = Fil.objects.create(titre='Suivi')
        f.participants.add(self.pilot, self.agent)
        MessageFil.objects.create(fil=f, auteur=self.agent, texte='Besoin de consigne')
        self.login(self.pilot)
        r = self.client.get('/messaging/fils/')
        self.assertEqual(r.status_code, 200)
        item = r.json()['items'][0]
        self.assertEqual(item['non_lus'], 1)
        self.assertEqual(item['dernier_message'], 'Besoin de consigne')

    def test_suppression_reservee_a_l_auteur(self):
        f = Fil.objects.create(titre='Suivi')
        f.participants.add(self.pilot, self.medecin)
        m = MessageFil.objects.create(fil=f, auteur=self.pilot, texte='Texte')
        self.login(self.medecin)
        self.assertEqual(self.client.post('/messaging/fils/message/%d/delete/' % m.pk).status_code, 403)
        self.login(self.pilot)
        self.assertEqual(self.client.post('/messaging/fils/message/%d/delete/' % m.pk).status_code, 200)
        m.refresh_from_db()
        self.assertTrue(m.supprime)

    def test_le_pilotage_voit_la_messagerie_dans_son_tableau_de_bord(self):
        self.login(self.pilot)
        r = self.client.get('/pilotage/')
        self.assertEqual(r.status_code, 200)
        for marqueur in ('data-fils', 'data-pubs', 'data-forum', 'view-messagerie',
                         'view-publications', 'view-forum'):
            self.assertContains(r, marqueur)