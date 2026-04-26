const service = require('../services/friendship.service');

const sendRequest = async (req, res) => {
  try {
    const friendship = await service.sendRequest(req.user.id, req.params.targetId);
    res.status(201).json(friendship);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const acceptRequest = async (req, res) => {
  try {
    const friendship = await service.acceptRequest(req.user.id, req.params.requesterId);
    res.json(friendship);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const rejectRequest = async (req, res) => {
  try {
    const friendship = await service.rejectRequest(req.user.id, req.params.requesterId);
    res.json(friendship);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const removeFriend = async (req, res) => {
  try {
    await service.removeFriend(req.user.id, req.params.friendId);
    res.json({ message: 'Amistad eliminada' });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const getMyFriends = async (req, res) => {
  try {
    const friendIds = await service.getMyFriends(req.user.id);

    // Enriquecer con datos de usuario
    if (friendIds.length === 0) return res.json([]);
    const userRes = await fetch(`${process.env.USER_SERVICE_URL}/api/users/internal/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: friendIds }),
    });
    const usersMap = userRes.ok ? await userRes.json() : {};

    const friends = friendIds.map((id) => ({
      userId: id,
      name: usersMap[id]?.name || '',
      avatar: usersMap[id]?.avatar || '',
    }));

    res.json(friends);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getPendingRequests = async (req, res) => {
  try {
    const requests = await service.getPendingRequests(req.user.id);
    res.json(requests);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getFriendshipStatus = async (req, res) => {
  try {
    const result = await service.getFriendshipStatus(req.user.id, req.params.otherId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
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
