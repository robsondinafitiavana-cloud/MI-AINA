from django.urls import path
from . import views

urlpatterns = [
    path('doctors/', views.doctors,   name='tm_doctors'),
    path('start/',   views.start_call, name='tm_start'),
    path('<int:pk>/terminer/', views.end_call, name='tm_end'),
]