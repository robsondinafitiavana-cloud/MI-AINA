from django.urls import path
from . import views

urlpatterns = [
    path('create/', views.report_create, name='report_create'),
    path('<int:pk>/delete/', views.report_delete, name='report_delete'),
]