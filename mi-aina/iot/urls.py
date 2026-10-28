from django.urls import path

from . import views

urlpatterns = [
    path('measures/', views.receive_measurement, name='iot_measure_receive'),
    path('simulation/', views.receive_simulation, name='iot_measure_simulation'),
]
