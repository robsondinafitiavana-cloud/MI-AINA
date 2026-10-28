from django.contrib import admin

from .models import CSB, District, Region


@admin.register(Region)
class RegionAdmin(admin.ModelAdmin):
	search_fields = ['nom']
	list_display = ['nom']


@admin.register(District)
class DistrictAdmin(admin.ModelAdmin):
	list_display = ['nom', 'region']
	list_filter = ['region']
	search_fields = ['nom', 'region__nom']


@admin.register(CSB)
class CSBAdmin(admin.ModelAdmin):
	list_display = ['code', 'nom', 'district', 'region']
	list_filter = ['region', 'district']
	search_fields = ['code', 'nom', 'district', 'region']
