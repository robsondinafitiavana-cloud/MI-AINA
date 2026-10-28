from django.urls import path
from . import views

urlpatterns = [
    path('transcribe/', views.transcribe,     name='ai_transcribe'),
    path('classify/',   views.classify_view,  name='ai_classify'),
    path('predict-disease/', views.predict_disease_view, name='ai_predict_disease'),
    path('speak/',      views.speak_view,     name='ai_speak'),
]
