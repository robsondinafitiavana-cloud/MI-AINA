from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('register/', views.register_view, name='register'),
    path('change-password/', views.change_password_view, name='change_password'),
    path('profile/', views.profile_view, name='profile'),
    path('prise-en-main/terminee/', views.complete_onboarding, name='onboarding_complete'),
    # Actions Pilotage (fetch JSON depuis dashboard/pilotage.js)
    path('comptes/<uuid:pk>/decision/', views.decide_compte, name='compte_decide'),
    path('comptes/<uuid:pk>/statut/', views.set_statut, name='compte_statut'),
]
