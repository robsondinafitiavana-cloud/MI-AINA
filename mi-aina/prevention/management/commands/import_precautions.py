import csv
import json
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils.text import slugify

from prevention.models import DiseasePrevention, PreventionMeasure


REQUIRED_COLUMNS = ['disease'] + [f'precaution_{i}' for i in range(1, 6)]


class Command(BaseCommand):
    help = 'Importe les précautions sans renommer les classes du modèle IA.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--csv', dest='csv_path',
            default=str(Path(__file__).resolve().parents[2] / 'data' / 'precautions.csv'),
            help='Chemin du fichier precautions.csv (par défaut : données de l’application).',
        )

    def handle(self, *args, **options):
        csv_path = Path(options['csv_path'])
        if not csv_path.is_file():
            raise CommandError(f'Fichier introuvable : {csv_path}')

        metadata_path = Path(settings.BASE_DIR) / 'models' / 'model_metadata.json'
        try:
            metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
            report = metadata['metrics']['classification_report']
            model_classes = set(report) - {'accuracy', 'macro avg', 'weighted avg'}
        except (OSError, ValueError, KeyError, TypeError) as exc:
            raise CommandError(f'Impossible de lire les classes IA dans {metadata_path}: {exc}')
        if not model_classes:
            raise CommandError('Aucune classe IA trouvée : import annulé.')

        try:
            with csv_path.open('r', encoding='utf-8-sig', newline='') as stream:
                reader = csv.DictReader(stream)
                missing_columns = [name for name in REQUIRED_COLUMNS if name not in (reader.fieldnames or [])]
                if missing_columns:
                    raise CommandError('Colonnes absentes du CSV : ' + ', '.join(missing_columns))
                rows = list(reader)
        except (OSError, csv.Error) as exc:
            raise CommandError(f'Lecture du CSV impossible : {exc}')

        names = [str(row.get('disease') or '').strip() for row in rows]
        if not names or any(not name for name in names):
            raise CommandError('Le CSV est vide ou contient un nom de maladie vide.')
        duplicates = sorted({name for name in names if names.count(name) > 1})
        if duplicates:
            raise CommandError('Noms de maladie dupliqués : ' + ', '.join(duplicates))

        csv_names = set(names)
        unmatched_csv = sorted(csv_names - model_classes)
        unmatched_model = sorted(model_classes - csv_names)
        if unmatched_csv or unmatched_model:
            details = ['Correspondance exacte requise : aucun nom ne sera corrigé automatiquement.']
            if unmatched_csv:
                details.append('CSV sans classe IA correspondante : ' + ', '.join(unmatched_csv))
            if unmatched_model:
                details.append('Classes IA sans fiche CSV : ' + ', '.join(unmatched_model))
            raise CommandError('\n'.join(details))

        for row in rows:
            blanks = [column for column in REQUIRED_COLUMNS[1:] if not (row.get(column) or '').strip()]
            if blanks:
                raise CommandError(
                    f"Précaution manquante pour {row['disease']}: {', '.join(blanks)}")

        slug_owners = {}
        for name in names:
            slug = slugify(name, allow_unicode=False)
            if not slug or (slug in slug_owners and slug_owners[slug] != name):
                raise CommandError(f'Collision ou slug vide pour le nom exact « {name} »; import annulé.')
            slug_owners[slug] = name

        created = 0
        with transaction.atomic():
            for row in rows:
                name = row['disease'].strip()
                fiche, was_created = DiseasePrevention.objects.get_or_create(
                    name=name, defaults={'slug': slugify(name, allow_unicode=False)})
                if was_created:
                    created += 1
                else:
                    expected_slug = slugify(name, allow_unicode=False)
                    if fiche.slug != expected_slug:
                        raise CommandError(
                            f'Le slug enregistré pour « {name} » est différent; import annulé.')
                fiche.precautions.all().delete()
                PreventionMeasure.objects.bulk_create([
                    PreventionMeasure(disease=fiche, text=row[column].strip(), position=index)
                    for index, column in enumerate(REQUIRED_COLUMNS[1:])
                ])

        self.stdout.write(self.style.SUCCESS(
            f'{len(rows)} fiches exactes importées, {len(rows) * 5} précautions enregistrées '
            f'({created} nouvelles fiches; aucune rubrique médicale supplémentaire renseignée).'))
