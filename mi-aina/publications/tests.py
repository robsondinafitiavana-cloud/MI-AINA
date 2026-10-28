# -*- coding: utf-8 -*-
"""Tests publications : lecture et publication par le médecin ET par le pilotage."""
import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.core.files.uploadedfile import SimpleUploadedFile

from csb.models import CSB
from notifications.models import Notif
from publications.models import Publication, PublicationLu

User = get_user_model()


def make_user(role, identifiant, csb=None, **extra):
    extra.setdefault('nom', 'Rakoto')
    extra.setdefault('prenom', 'Soa')
    extra.setdefault('statut', 'ACTIF')
    return User.objects.create_user(role, identifiant, 'MotDePasse12345', csb=csb, **extra)


class PublicationsTests(TestCase):
    def setUp(self):
        self.csb = CSB.objects.create(code='CSB-P1', nom='CSB Test', district='Antananarivo',
                                      region='Analamanga')
        self.medecin = make_user('MEDECIN', 'ORD-P-001', self.csb)
        self.agent = make_user('PREMIERE_LIGNE', 'MAT-P-001', self.csb)
        self.pilot = make_user('PILOTAGE', 'pilote@test.mg', direction='Administration nationale')
        self.pub = Publication.objects.create(type='protocole', titre='Paludisme simple',
                                              resume='Protocole national', auteur=self.medecin)

    def login(self, u):
        self.client.force_login(u, backend='django.contrib.auth.backends.ModelBackend')

    def post_json(self, url, payload):
        return self.client.post(url, data=json.dumps(payload), content_type='application/json')

    def test_medecin_publie_et_notifie_les_agents(self):
        self.login(self.medecin)
        r = self.post_json('/publications/publish/',
                           {'type': 'texte', 'titre': 'Nouveau protocole', 'resume': 'Contenu'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Publication.objects.count(), 2)
        self.assertEqual(Notif.objects.filter(role_cible='agent').count(), 1)

    def test_pilotage_publie_aussi(self):
        self.login(self.pilot)
        r = self.post_json('/publications/publish/',
                           {'type': 'protocole', 'titre': 'Directive nationale', 'resume': 'À appliquer'})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['ok'])
        self.assertEqual(Publication.objects.get(titre='Directive nationale').auteur, self.pilot)
        self.assertEqual(Notif.objects.filter(role_cible='tous').count(), 1)

    def test_medecin_publie_un_fichier_media(self):
        self.login(self.medecin)
        fichier = SimpleUploadedFile('guide.pdf', b'%PDF-1.4 guide', content_type='application/pdf')
        r = self.client.post('/publications/publish/', {
            'type': 'pdf', 'titre': 'Guide terrain', 'resume': 'Document utile', 'fichier': fichier,
        })
        self.assertEqual(r.status_code, 200)
        publication = Publication.objects.get(titre='Guide terrain')
        self.assertTrue(publication.fichier)
        self.assertTrue(r.json()['publication']['fichier_nom'].startswith('guide'))
        self.assertTrue(r.json()['publication']['fichier_nom'].endswith('.pdf'))

    def test_agent_ne_publie_pas(self):
        self.login(self.agent)
        r = self.post_json('/publications/publish/', {'titre': 'X', 'resume': 'Y'})
        self.assertEqual(r.status_code, 403)

    def test_titre_et_contenu_obligatoires(self):
        self.login(self.medecin)
        self.assertEqual(self.post_json('/publications/publish/', {'titre': '', 'resume': ''}).status_code, 400)

    def test_feed_lu_par_les_trois_roles(self):
        for u in (self.agent, self.medecin, self.pilot):
            self.login(u)
            r = self.client.get('/publications/feed/')
            self.assertEqual(r.status_code, 200, u.role)
            self.assertEqual(len(r.json()['items']), 1)

    def test_accuse_de_lecture_idempotent(self):
        self.login(self.agent)
        r1 = self.client.post('/publications/%d/lu/' % self.pub.pk)
        self.assertEqual(r1.json()['vues'], 1)
        r2 = self.client.post('/publications/%d/lu/' % self.pub.pk)
        self.assertEqual(r2.json()['vues'], 1)
        self.assertEqual(PublicationLu.objects.count(), 1)

    def test_pilotage_voit_publications_et_forum_dans_son_interface(self):
        self.login(self.pilot)
        r = self.client.get('/pilotage/')
        self.assertContains(r, 'Paludisme simple')
        self.assertContains(r, 'data-pubs')
        self.assertContains(r, 'data-forum')