import { FeedbackCategory } from '@prisma/client';

// Pure business rules without external dependencies.
export function feedbackCategoryFor(score: number): FeedbackCategory {
	if (score >= 90) return FeedbackCategory.SANGAT_BAIK;
	if (score >= 80) return FeedbackCategory.BAIK;
	if (score >= 70) return FeedbackCategory.CUKUP;
	return FeedbackCategory.PERLU_LATIHAN;
}
