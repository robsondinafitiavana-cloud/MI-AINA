from django.urls import path
from . import views

urlpatterns = [
    path('forum/', views.forum_list, name='forum_list'),
    path('forum/creer/', views.forum_create, name='forum_create'),
    path('forum/<int:pk>/repondre/', views.forum_reply, name='forum_reply'),
    path('ressources/', views.ressources_list, name='ressources_list'),
]