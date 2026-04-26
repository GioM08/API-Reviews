const Notification = require('../models/notification.model');
const DeviceToken = require('../models/device_token.model');

const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, read: false });
    res.json({ count });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const markAsRead = async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json(notif);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id, read: false }, { read: true });
    res.json({ message: 'Todas las notificaciones marcadas como leídas' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const registerToken = async (req, res) => {
  try {
    const { token, platform = 'web' } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    await DeviceToken.findOneAndUpdate(
      { token },
      { userId: req.user.id, token, platform },
      { upsert: true, new: true }
    );
    res.json({ message: 'Token registrado' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

const removeToken = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token requerido' });

    await DeviceToken.deleteOne({ token, userId: req.user.id });
    res.json({ message: 'Token eliminado' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports = {
  getMyNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerToken,
  removeToken,
};
