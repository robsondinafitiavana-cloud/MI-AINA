import json as _json

def body(request):
    """Lit le corps JSON d'un POST, ou retombe sur request.POST."""
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        return request.POST
    if request.body:
        try:
            return _json.loads(request.body)
        except Exception:
            pass
    return request.POST