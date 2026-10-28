# -*- coding: utf-8 -*-
"""MI-AINA — formulaire Django de création / modification d'un CSB."""
from django import forms

from .models import CSB, District, Region


class CSBForm(forms.ModelForm):
    """Formulaire officiel du CSB — seuls code, nom, district et région sont requis."""

    region = forms.ChoiceField(choices=(), widget=forms.Select(attrs={'class': 'f-input'}))
    district = forms.ChoiceField(choices=(), widget=forms.Select(attrs={'class': 'f-input'}))

    class Meta:
        model = CSB
        fields = ['code', 'nom', 'district', 'region',
                  'telephone', 'adresse', 'latitude', 'longitude', 'photo_url']
        widgets = {
            'code': forms.TextInput(attrs={'placeholder': 'CSB1XX', 'class': 'f-input'}),
            'nom': forms.TextInput(attrs={'placeholder': 'CSB Ambohimanarina', 'class': 'f-input'}),
            'telephone': forms.TextInput(attrs={'placeholder': '034 00 000 00', 'class': 'f-input'}),
            'adresse': forms.TextInput(attrs={'placeholder': 'Fokontany / rue', 'class': 'f-input'}),
            'latitude': forms.NumberInput(attrs={'placeholder': '-18.913', 'step': '0.000001', 'class': 'f-input'}),
            'longitude': forms.NumberInput(attrs={'placeholder': '47.536', 'step': '0.000001', 'class': 'f-input'}),
            'photo_url': forms.URLInput(attrs={'placeholder': 'https://… (photo du centre)', 'class': 'f-input'}),
        }

    def clean_code(self):
        return (self.cleaned_data.get('code') or '').strip().upper()

    def clean(self):
        data = super().clean()
        region = data.get('region')
        district = data.get('district')
        district_obj = District.objects.filter(nom=district).select_related('region').first()
        if region and district and (not district_obj or district_obj.region.nom != region):
            self.add_error('district', 'Ce district ne correspond pas à la région choisie.')
        lat, lng = data.get('latitude'), data.get('longitude')
        if (lat is None) != (lng is None):
            self.add_error('latitude', 'Renseignez la latitude ET la longitude, ou aucune des deux.')
        return data

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        regions = Region.objects.order_by('nom')
        districts = District.objects.select_related('region').order_by('region__nom', 'nom')
        self.fields['region'].choices = [('', '— Choisir une région —')] + [
            (r.nom, r.nom) for r in regions]
        self.fields['district'].choices = [('', '— Choisir un district —')] + [
            (d.nom, f'{d.nom} · {d.region.nom}') for d in districts]
        if self.instance and self.instance.pk:
            self.initial['region'] = self.instance.region
            self.initial['district'] = self.instance.district
            self._district_region = District.objects.filter(
                nom=self.instance.district,
                region__nom=self.instance.region,
            ).values_list('region__nom', flat=True).first()

    def save(self, commit=True):
        instance = super().save(commit=False)
        instance.region = self.cleaned_data['region']
        instance.district = self.cleaned_data['district']
        if commit:
            instance.save()
        return instance
