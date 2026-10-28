from django.contrib import admin
from .models import PatientAccessLog


@admin.register(PatientAccessLog)
class PatientAccessLogAdmin(admin.ModelAdmin):
    list_display = ('cree_le', 'utilisateur', 'patient_code', 'action')
    list_filter = ('action', 'cree_le')
    search_fields = ('patient__code_patient', 'utilisateur__nom', 'utilisateur__prenom')
    readonly_fields = ('patient', 'utilisateur', 'action', 'cree_le')
    ordering = ('-cree_le',)

    @admin.display(description='Code patient', ordering='patient__code_patient')
    def patient_code(self, obj):
        return obj.patient.code_patient

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
