from django.urls import path
from . import views

urlpatterns = [
    path('feed/', views.feed, name='pub_feed'),
    path('publish/', views.publish, name='pub_publish'),
    path('<int:pk>/lu/', views.marquer_lu, name='pub_lu'),
]