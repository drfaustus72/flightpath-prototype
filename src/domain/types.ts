import type { z } from 'zod'
import type {
  accountSchema,
  airportSchema,
  clubPlanSchema,
  clubSchema,
  membershipRoleSchema,
  membershipSchema,
  profileFieldSchema,
  visibilitySchema,
  worldSchema,
} from './schemas'

export type Account = z.infer<typeof accountSchema>
export type Club = z.infer<typeof clubSchema>
export type ClubPlan = z.infer<typeof clubPlanSchema>
export type Membership = z.infer<typeof membershipSchema>
export type MembershipRole = z.infer<typeof membershipRoleSchema>
export type Airport = z.infer<typeof airportSchema>
export type ProfileField = z.infer<typeof profileFieldSchema>
export type Visibility = z.infer<typeof visibilitySchema>
export type World = z.infer<typeof worldSchema>
