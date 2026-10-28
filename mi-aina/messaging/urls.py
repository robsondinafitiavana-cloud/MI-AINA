from django.urls import path

from . import boite, fils, views

urlpatterns = [
    # --- page de messagerie SIMPLE (Django + formulaire, sans AJAX) ---
    path('',             views.inbox,          name='inbox'),
    path('boite/',       boite.boite,          name='msg_boite'),
    path('boite/nouveau/', boite.boite_nouveau, name='msg_boite_nouveau'),
    path('boite/<int:pk>/', boite.boite_fil,   name='msg_boite_fil'),

    # --- fils terrain (agent <-> médecin) ---
    path('<int:pk>/messages/', views.thread_messages, name='msg_list'),
    path('thread/create/',      views.thread_create,    name='msg_thread_create'),
    path('<int:pk>/send/',     views.message_send,    name='msg_send'),
    path('message/<int:pk>/delete/', views.message_delete, name='msg_delete'),

    # --- fils inter-rôles (participants libres, ouverts au Pilotage) ---
    path('fils/',                          fils.fils_list,    name='fils_list'),
    path('fils/creer/',                    fils.fil_create,   name='fil_create'),
    path('fils/annuaire/',                 fils.annuaire,     name='fils_annuaire'),
    path('fils/<int:pk>/messages/',        fils.fil_messages, name='fil_messages'),
    path('fils/<int:pk>/send/',            fils.fil_send,     name='fil_send'),
    path('fils/message/<int:mid>/delete/', fils.fil_delete,   name='fil_delete'),
]
