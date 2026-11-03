import prisma from "../config/prisma.js";

export interface PostLiker {
  id: number;
  user_name: string | null;
  profile_url: string | null;
}

export const getLikersByPostIds = async (
  postIds: number[],
  perPost = 3
): Promise<Map<number, PostLiker[]>> => {
  const likersMap = new Map<number, PostLiker[]>();
  if (postIds.length === 0) return likersMap;

  const rows = await prisma.likes.findMany({
    where: { post_id: { in: postIds } },
    select: {
      post_id: true,
      users: {
        select: { id: true, user_name: true, profile_url: true },
      },
    },
    orderBy: { created_at: "desc" },
  });

  for (const row of rows) {
    if (!row.users) continue;
    const likers = likersMap.get(row.post_id) ?? [];
    if (likers.length < perPost) {
      likers.push(row.users);
      likersMap.set(row.post_id, likers);
    }
  }

  return likersMap;
};
