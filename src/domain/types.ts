import type { z } from 'zod'
import type {
  accountSchema,
  achievementSchema,
  flightSchema,
  flightStatsSchema,
  landingSchema,
  airportSchema,
  clubPlanSchema,
  clubSchema,
  membershipRoleSchema,
  membershipSchema,
  profileFieldSchema,
  visibilitySchema,
  worldSchema,
  profileLevelSchema,
  tagSchema,
  milestoneCodeSchema,
  followSchema,
  propSchema,
  commentSchema,
  debriefMessageSchema,
  cfiLinkSchema,
  signoffSchema,
  signoffRequestSchema,
  blockSchema,
  reportSchema,
  missionSchema,
  missionRequirementsSchema,
  pathwaySchema,
  challengeSchema,
  challengeEntrySchema,
  noGoSchema,
  missionVerificationSchema,
  missionClaimSchema,
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
export type Flight = z.infer<typeof flightSchema>
export type FlightStats = z.infer<typeof flightStatsSchema>
export type Landing = z.infer<typeof landingSchema>
export type Achievement = z.infer<typeof achievementSchema>
export type ProfileLevel = z.infer<typeof profileLevelSchema>
export type Tag = z.infer<typeof tagSchema>
export type MilestoneCode = z.infer<typeof milestoneCodeSchema>
export type Follow = z.infer<typeof followSchema>
export type Prop = z.infer<typeof propSchema>
export type Comment = z.infer<typeof commentSchema>
export type DebriefMessage = z.infer<typeof debriefMessageSchema>
export type CfiLink = z.infer<typeof cfiLinkSchema>
export type Signoff = z.infer<typeof signoffSchema>
export type SignoffRequest = z.infer<typeof signoffRequestSchema>
export type Block = z.infer<typeof blockSchema>
export type Report = z.infer<typeof reportSchema>
export type Mission = z.infer<typeof missionSchema>
export type MissionRequirements = z.infer<typeof missionRequirementsSchema>
export type Pathway = z.infer<typeof pathwaySchema>
export type Challenge = z.infer<typeof challengeSchema>
export type ChallengeEntry = z.infer<typeof challengeEntrySchema>
export type NoGo = z.infer<typeof noGoSchema>
export type MissionVerification = z.infer<typeof missionVerificationSchema>
export type MissionClaim = z.infer<typeof missionClaimSchema>
