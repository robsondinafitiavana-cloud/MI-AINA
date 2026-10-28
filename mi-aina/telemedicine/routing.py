from django.urls import re_path

from .consumers import TelemedicineConsumer


websocket_urlpatterns = [
    re_path(r'^ws/telemedicine/(?P<room_id>[0-9]+)/$', TelemedicineConsumer.as_asgi()),
]