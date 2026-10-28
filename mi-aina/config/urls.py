from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
        path('publications/', include('publications.urls')),
    path('', include('accounts.urls')),
    path('', include('dashboard.urls')),
    path('csb/', include('csb.urls')),
    path('patients/', include('patients.urls')),
    path('consultations/', include('consultations.urls')),
    path('messaging/', include('messaging.urls')),
    path('telemedicine/', include('telemedicine.urls')),
    path('iot/', include('iot.urls')),
    path('reports/', include('reports.urls')),
    path('formation/', include('formation.urls')),
    path('alerts/', include('alerts.urls')),
    path('notifications/', include('notifications.urls')),
    path('ai/', include('ai.urls')),
    path('prevention/', include('prevention.urls')),
    path('assistant/', include('assistant.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
