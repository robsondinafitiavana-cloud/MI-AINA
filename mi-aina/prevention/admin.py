from django.contrib import admin

from .models import DiseasePrevention, PreventionMeasure


class PreventionMeasureInline(admin.TabularInline):
    model = PreventionMeasure
    extra = 0


@admin.register(DiseasePrevention)
class DiseasePreventionAdmin(admin.ModelAdmin):
    list_display = ('name', 'verified_at', 'updated_at')
    search_fields = ('name',)
    prepopulated_fields = {'slug': ('name',)}
    inlines = [PreventionMeasureInline]
