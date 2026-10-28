from django.contrib import admin

from .models import Publication, PublicationLu


@admin.register(Publication)
class PublicationAdmin(admin.ModelAdmin):
	list_display = ['titre', 'type', 'auteur', 'epingle', 'created_at']
	list_filter = ['type', 'epingle', 'created_at']
	search_fields = ['titre', 'resume', 'auteur__nom', 'auteur__prenom']
	readonly_fields = ['created_at']


@admin.register(PublicationLu)
class PublicationLuAdmin(admin.ModelAdmin):
	list_display = ['publication', 'agent', 'lu_le']
	list_filter = ['lu_le']
	search_fields = ['publication__titre', 'agent__nom', 'agent__prenom']
	readonly_fields = ['lu_le']
