"""Règles de rattachement local des avis de première ligne."""

from django.db.models import Q
from accounts.models import Compte


def same_care_site(agent, medecin):
    """Un avis automatique reste dans le même CSB ou le même établissement."""
    if not agent or not medecin:
        return False
    if agent.csb_id or medecin.csb_id:
        return bool(agent.csb_id and medecin.csb_id and agent.csb_id == medecin.csb_id)
    site_agent = (agent.etablissement or '').strip().casefold()
    site_medecin = (medecin.etablissement or '').strip().casefold()
    return bool(site_agent and site_medecin and site_agent == site_medecin)


def local_doctors_for(agent):
    """Médecins actifs rattachés à la même structure principale que l'agent."""
    doctors = Compte.objects.filter(role='MEDECIN', statut='ACTIF').select_related('csb')
    if agent.csb_id:
        return doctors.filter(csb_id=agent.csb_id)
    site = (agent.etablissement or '').strip()
    if site:
        return doctors.filter(csb__isnull=True, etablissement__iexact=site)
    return doctors.none()


def local_unassigned_cases(medecin):
    """Consultations non attribuées du CSB/établissement du médecin."""
    filters = Q(pk__in=[])
    if medecin.csb_id:
        filters |= Q(patient__csb_id=medecin.csb_id)
        filters |= Q(patient__csb__isnull=True, patient__agent_referent__csb_id=medecin.csb_id)
    else:
        site = (medecin.etablissement or '').strip()
        if site:
            filters |= Q(patient__agent_referent__csb__isnull=True,
                         patient__agent_referent__etablissement__iexact=site)
    return filters
