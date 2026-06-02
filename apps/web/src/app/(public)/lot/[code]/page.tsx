"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import {
  PublicLotProofSkeleton,
  PublicLotProofView,
} from "@/components/copernicus/public-lot-proof-view";
import { trpc } from "@/utils/trpc";

function safeDecodeCode(value: string | undefined) {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default function PublicLotProofPage() {
  const params = useParams<{ code: string }>();
  const code = safeDecodeCode(params.code);

  const { data, isLoading } = useQuery(
    trpc.lots.publicByCode.queryOptions({ code }, { enabled: code.length > 0 }),
  );

  if (isLoading) {
    return <PublicLotProofSkeleton />;
  }

  return (
    <PublicLotProofView
      data={
        data
          ? {
              lot: data.lot,
              snapshot: data.snapshot,
            }
          : null
      }
    />
  );
}
