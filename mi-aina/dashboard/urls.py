from django.urls import path
from . import views

urlpatterns = [
    path('',            views.dashboard_redirect, name='dashboard'),
    path('dashboard/',  views.dashboard_redirect, name='dashboard_root'),
    path('premiere-ligne/', views.agent,    name='agent'),
    path('medecin/',        views.medecin,  name='medecin'),
    path('pilotage/',       views.pilotage, name='pilotage'),
    path('ai/zone-analyse/', views.zone_analyse, name='zone_analyse'),
    path('agent-feed/', views.agent_feed, name='agent_feed'),
    path('surveillance/data/', views.surveillance_data, name='surveillance_data'),
]