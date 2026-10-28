from django.urls import path
from . import views

urlpatterns = [
    path('<str:code>/pdf/', views.patient_pdf, name='patient_pdf'),
    path('create/', views.patient_create, name='patient_create'),
    path('sync-lecture/', views.sync_lecture, name='sync_lecture'),
    path('notifs-lu/', views.notifs_lu, name='notifs_lu'),
    path('<str:code>/data/', views.patient_detail_data, name='patient_detail_data'),
    path('<str:code>/', views.patient_detail, name='patient_detail'),
]
