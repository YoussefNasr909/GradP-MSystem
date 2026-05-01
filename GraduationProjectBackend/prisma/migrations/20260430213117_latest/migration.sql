/*
  Warnings:

  - You are about to drop the `Discussion` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DiscussionComment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DiscussionLike` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DiscussionView` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Discussion" DROP CONSTRAINT "Discussion_authorId_fkey";

-- DropForeignKey
ALTER TABLE "DiscussionComment" DROP CONSTRAINT "DiscussionComment_authorId_fkey";

-- DropForeignKey
ALTER TABLE "DiscussionComment" DROP CONSTRAINT "DiscussionComment_discussionId_fkey";

-- DropForeignKey
ALTER TABLE "DiscussionComment" DROP CONSTRAINT "DiscussionComment_parentCommentId_fkey";

-- DropForeignKey
ALTER TABLE "DiscussionLike" DROP CONSTRAINT "DiscussionLike_discussionId_fkey";

-- DropForeignKey
ALTER TABLE "DiscussionLike" DROP CONSTRAINT "DiscussionLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "DiscussionView" DROP CONSTRAINT "DiscussionView_discussionId_fkey";

-- DropForeignKey
ALTER TABLE "DiscussionView" DROP CONSTRAINT "DiscussionView_userId_fkey";

-- DropTable
DROP TABLE "Discussion";

-- DropTable
DROP TABLE "DiscussionComment";

-- DropTable
DROP TABLE "DiscussionLike";

-- DropTable
DROP TABLE "DiscussionView";

-- DropEnum
DROP TYPE "DiscussionCategory";
