from django.urls import path
from . import views

urlpatterns = [
    path('<int:pk>/traiter/', views.traiter, name='alerte_traiter'),
]