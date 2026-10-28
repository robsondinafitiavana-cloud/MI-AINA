from django.urls import path
from . import views

urlpatterns = [
    path('history/', views.history, name='ia_history'),
    path('send/',    views.send,    name='ia_send'),
    path('reset/',   views.reset,   name='ia_reset'),
]