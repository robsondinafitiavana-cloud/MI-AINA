from django.urls import path

from . import views

app_name = 'prevention'

urlpatterns = [
    path('', views.prevention_list, name='list'),
    path('maladie/<slug:slug>/', views.prevention_detail, name='detail'),
]
