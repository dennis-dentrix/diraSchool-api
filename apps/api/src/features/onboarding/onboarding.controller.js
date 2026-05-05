import User from '../users/User.model.js';
import { sendSuccess, sendError } from '../../utils/response.js';

export const getOnboardingStatus = async (req, res) => {
  const user = await User.findById(req.user._id).select('has_completed_onboarding_tour tour_completed_at');
  if (!user) return sendError(res, 'User not found', 404);

  return sendSuccess(res, {
    tour_completed: user.has_completed_onboarding_tour ?? false,
    tour_completed_at: user.tour_completed_at ?? null,
  });
};

export const completeOnboarding = async (req, res) => {
  const { completed = true, skipped = false } = req.body;

  await User.findByIdAndUpdate(req.user._id, {
    has_completed_onboarding_tour: completed,
    tour_completed_at: completed ? new Date() : undefined,
  });

  return sendSuccess(res, { success: true, skipped });
};
