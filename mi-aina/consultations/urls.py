from django.urls import path
from . import views

urlpatterns = [
    path('save/', views.consult_save, name='consult_save'),
    path('<str:pk>/prendre/', views.prendre, name='consult_prendre'),
    path('<str:pk>/valider-ia/', views.valider_ia, name='consult_valider_ia'),
    path('<str:pk>/ordonnance/', views.ordonnance, name='consult_ordonnance'),
    path('<str:pk>/orienter/', views.orienter, name='consult_orienter'),
    path('<str:pk>/remise/', views.remise, name='consult_remise'),
    path('<str:pk>/retour/', views.retour, name='consult_retour'),
    path('<str:pk>/remise-page/', views.remise_page, name='consult_remise_page'),
]