import secrets

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError

from iot.models import Device


class Command(BaseCommand):
    help = 'Génère une authentification pour un boîtier IoT et affiche le jeton une seule fois.'

    def add_arguments(self, parser):
        parser.add_argument('device_code', help='Code existant du boîtier')
        parser.add_argument('--rotate', action='store_true', help='Remplace un jeton déjà configuré')

    def handle(self, *args, **options):
        try:
            device = Device.objects.get(code=options['device_code'])
        except Device.DoesNotExist as exc:
            raise CommandError('Aucun boîtier avec ce code.') from exc

        if device.token_hash and not options['rotate']:
            raise CommandError('Un jeton existe déjà. Utilisez --rotate pour le remplacer.')

        token = secrets.token_urlsafe(32)
        device.token_hash = make_password(token)
        device.save(update_fields=['token_hash'])
        self.stdout.write(self.style.SUCCESS(f'Boîtier : {device.code}'))
        self.stdout.write('Jeton à copier dans la configuration locale ESP32 (affiché une seule fois) :')
        self.stdout.write(token)
