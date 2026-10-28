from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from .models import CallSession


class TelemedicineConsumer(AsyncJsonWebsocketConsumer):
    async def connect(self):
        self.room_id = self.scope['url_route']['kwargs']['room_id']
        self.room_group = f'telemedicine_{self.room_id}'
        self.joined = False

        if not await self.user_can_join():
            await self.close(code=4403)
            return

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        self.joined = True
        await self.accept()
        await self.send_json({'type': 'ready'})
        await self.channel_layer.group_send(
            self.room_group,
            {'type': 'peer.joined', 'sender': self.channel_name},
        )

    async def disconnect(self, close_code):
        if getattr(self, 'joined', False):
            await self.channel_layer.group_discard(self.room_group, self.channel_name)
            await self.channel_layer.group_send(
                self.room_group,
                {'type': 'peer.left', 'sender': self.channel_name},
            )

    async def receive_json(self, content, **kwargs):
        message_type = content.get('type')
        if message_type not in {'offer', 'answer', 'ice', 'hangup'}:
            return
        await self.channel_layer.group_send(
            self.room_group,
            {
                'type': 'signal.message',
                'sender': self.channel_name,
                'payload': content,
            },
        )

    async def peer_joined(self, event):
        if event['sender'] != self.channel_name:
            await self.send_json({'type': 'peer-joined'})

    async def peer_left(self, event):
        if event['sender'] != self.channel_name:
            await self.send_json({'type': 'peer-left'})

    async def signal_message(self, event):
        if event['sender'] != self.channel_name:
            await self.send_json(event['payload'])

    @database_sync_to_async
    def user_can_join(self):
        user = self.scope.get('user')
        if not user or not user.is_authenticated:
            return False
        return CallSession.objects.filter(
            pk=self.room_id,
            ended_at__isnull=True,
        ).filter(
            agent=user,
        ).exists() or CallSession.objects.filter(
            pk=self.room_id,
            ended_at__isnull=True,
            medecin=user,
        ).exists()

