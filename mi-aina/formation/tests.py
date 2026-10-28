# -*- coding: utf-8 -*-
"""Tests du forum médical (formation) : ouverture, réponse, lecture, droits."""
from django.contrib.auth import get_user_model
from django.test import TestCase

from csb.models import CSB
from formation.models import ForumPost, ForumReply

User = get_user_model()


def make_user(role, identifiant, csb=None, **extra):
    extra.setdefault('nom', 'Rakoto')
    extra.setdefault('prenom', 'Soa')
    extra.setdefault('statut', 'ACTIF')
    return User.objects.create_user(role, identifiant, 'MotDePasse12345', csb=csb, **extra)


class ForumTests(TestCase):
    def setUp(self):
        self.csb = CSB.objects.create(code='CSB-F1', nom='CSB Test', district='Antananarivo',
                                      region='Analamanga')
        self.medecin = make_user('MEDECIN', 'ORD-F-001', self.csb)
        self.pilot = make_user('PILOTAGE', 'pilote@test.mg', direction='Administration nationale')
        self.agent = make_user('PREMIERE_LIGNE', 'MAT-F-001', self.csb)

    def login(self, u):
        self.client.force_login(u, backend='django.contrib.auth.backends.ModelBackend')

    def test_medecin_ouvre_un_sujet(self):
        self.login(self.medecin)
        r = self.client.post('/formation/forum/creer/',
                             {'question': 'Posologie artéméther chez l enfant ?',
                              'tags': 'PÉDIATRIE,PALUDISME'})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['ok'])
        self.assertEqual(ForumPost.objects.count(), 1)
        self.assertEqual(r.json()['post']['reponses'], 0)

    def test_premiere_ligne_peut_ouvrir_un_sujet(self):
        self.login(self.agent)
        r = self.client.post('/formation/forum/creer/',
                             {'question': 'Comment suivre un enfant après le traitement ?',
                              'tags': 'SUIVI,PÉDIATRIE'})
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['ok'])
        self.assertEqual(ForumPost.objects.first().auteur, self.agent)

    def test_pilotage_ouvre_un_sujet(self):
        self.login(self.pilot)
        r = self.client.post('/formation/forum/creer/',
                             {'question': 'Retour terrain sur les ruptures de stock ?'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(ForumPost.objects.first().auteur, self.pilot)

    def test_question_trop_courte_refusee(self):
        self.login(self.medecin)
        self.assertEqual(self.client.post('/formation/forum/creer/', {'question': 'abc'}).status_code, 400)

    def test_reponse_par_un_agent_notifie_l_auteur(self):
        p = ForumPost.objects.create(question='Sujet de test suffisamment long', auteur=self.medecin)
        self.login(self.agent)
        r = self.client.post('/formation/forum/%d/repondre/' % p.pk,
                             {'reponse': 'Chez le nourrisson, réduire la dose.'})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(ForumReply.objects.count(), 1)
        self.assertEqual(r.json()['post']['reponses'], 1)
        self.assertEqual(self.medecin.notifs.count(), 1)

    def test_lecture_du_forum_avec_reponses(self):
        p = ForumPost.objects.create(question='Sujet visible par le pilotage', auteur=self.medecin)
        ForumReply.objects.create(post=p, auteur=self.medecin, reponse='Précision clinique')
        self.login(self.pilot)
        r = self.client.get('/formation/forum/')
        self.assertEqual(r.status_code, 200)
        item = r.json()['items'][0]
        self.assertEqual(item['question'], 'Sujet visible par le pilotage')
        self.assertEqual(item['reponses'], 1)
        self.assertEqual(item['reponses_list'][0]['reponse'], 'Précision clinique')

    def test_reponses_visibles_par_medecin_agent_et_pilotage(self):
        p = ForumPost.objects.create(question='Discussion partagée entre les trois rôles', auteur=self.medecin)
        ForumReply.objects.create(post=p, auteur=self.agent, reponse='Observation depuis le terrain.')
        for user in (self.medecin, self.agent, self.pilot):
            self.login(user)
            response = self.client.get('/formation/forum/')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['items'][0]['reponses_list'][0]['reponse'],
                             'Observation depuis le terrain.')

    def test_acces_reserve_aux_comptes_authentifies_et_roles(self):
        r = self.client.get('/formation/forum/')
        self.assertIn(r.status_code, (302, 403))

    def test_ressources_de_formation(self):
        self.login(self.medecin)
        r = self.client.get('/formation/ressources/')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()['ok'])
