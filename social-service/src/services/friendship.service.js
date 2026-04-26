const Friendship = require('../models/friendship.model');
const { publishFriendshipEvent } = require('../utils/broker.util');

const sendRequest = async (requesterId, recipientId) => {
  if (requesterId === recipientId) throw new Error('No puedes enviarte una solicitud a ti mismo');

  const existing = await Friendship.findOne({
    $or: [
      { requesterId, recipientId },
      { requesterId: recipientId, recipientId: requesterId },
    ],
  });
  if (existing) {
    if (existing.status === 'accepted') throw new Error('Ya sois amigos');
    if (existing.status === 'pending') throw new Error('Ya hay una solicitud pendiente');
    if (existing.status === 'rejected') {
      existing.status = 'pending';
      existing.requesterId = requesterId;
      existing.recipientId = recipientId;
      return existing.save();
    }
  }

  const friendship = await Friendship.create({ requesterId, recipientId });
  await publishFriendshipEvent('friend_request_sent', { requesterId, recipientId });
  return friendship;
};

const acceptRequest = async (recipientId, requesterId) => {
  const friendship = await Friendship.findOneAndUpdate(
    { requesterId, recipientId, status: 'pending' },
    { status: 'accepted' },
    { new: true }
  );
  if (!friendship) throw new Error('Solicitud no encontrada');
  await publishFriendshipEvent('friend_request_accepted', { requesterId, recipientId });
  return friendship;
};

const rejectRequest = async (recipientId, requesterId) => {
  const friendship = await Friendship.findOneAndUpdate(
    { requesterId, recipientId, status: 'pending' },
    { status: 'rejected' },
    { new: true }
  );
  if (!friendship) throw new Error('Solicitud no encontrada');
  return friendship;
};

const removeFriend = async (userId, friendId) => {
  const result = await Friendship.findOneAndDelete({
    $or: [
      { requesterId: userId, recipientId: friendId, status: 'accepted' },
      { requesterId: friendId, recipientId: userId, status: 'accepted' },
    ],
  });
  if (!result) throw new Error('Amistad no encontrada');
};

const getMyFriends = async (userId) => {
  const friendships = await Friendship.find({
    $or: [{ requesterId: userId }, { recipientId: userId }],
    status: 'accepted',
  });
  return friendships.map((f) =>
    f.requesterId === userId ? f.recipientId : f.requesterId
  );
};

const getPendingRequests = async (userId) => {
  return Friendship.find({ recipientId: userId, status: 'pending' });
};

const getFriendshipStatus = async (userId, otherId) => {
  const f = await Friendship.findOne({
    $or: [
      { requesterId: userId, recipientId: otherId },
      { requesterId: otherId, recipientId: userId },
    ],
  });
  if (!f) return { status: 'none' };
  return { status: f.status, requesterId: f.requesterId };
};

module.exports = {
  sendRequest,
  acceptRequest,
  rejectRequest,
  removeFriend,
  getMyFriends,
  getPendingRequests,
  getFriendshipStatus,
};
