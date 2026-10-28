from django.core.paginator import Paginator
from django.shortcuts import get_object_or_404, render

from core.decorators import role_required
from .models import DiseasePrevention


LECTURE_PREVENTION = ('PREMIERE_LIGNE', 'MEDECIN', 'PILOTAGE')


@role_required(LECTURE_PREVENTION)
def prevention_list(request):
    query = (request.GET.get('q') or '').strip()
    fiches = DiseasePrevention.objects.prefetch_related('precautions')
    if query:
        fiches = fiches.filter(name__icontains=query)
    page = Paginator(fiches, 24).get_page(request.GET.get('page'))
    return render(request, 'prevention/list.html', {
        'page': page,
        'query': query,
        'total_fiches': DiseasePrevention.objects.count(),
    })


@role_required(LECTURE_PREVENTION)
def prevention_detail(request, slug):
    fiche = get_object_or_404(
        DiseasePrevention.objects.prefetch_related('precautions'), slug=slug)
    return render(request, 'prevention/detail.html', {'fiche': fiche})
