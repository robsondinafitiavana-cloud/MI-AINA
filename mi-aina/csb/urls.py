from django.urls import path

from . import views

urlpatterns = [
    path('nouveau/', views.csb_nouveau, name='csb_nouveau'),
    path('create/', views.csb_create, name='csb_create'),
    path('<str:code>/', views.csb_detail, name='csb_detail'),
    path('<str:code>/modifier/', views.csb_edit, name='csb_edit'),
]
