from django.urls import path
from . import views

urlpatterns = [
    path('<int:pk>/open/', views.open_notification, name='notification_open'),
    path('feed/', views.feed, name='notifications_feed'),
    path('read-all/', views.mark_all_read, name='notifications_read_all'),
]
