"use client";

import { useTranslations } from "next-intl";
import { motion } from "framer-motion";

export function LandingSocialProof() {
  const t = useTranslations("landing");

  const stats = [
    { value: t("social_proof_col1_val"), label: t("social_proof_col1_label") },
    { value: t("social_proof_col2_val"), label: t("social_proof_col2_label") },
    { value: t("social_proof_col3_val"), label: t("social_proof_col3_label") },
    { value: t("social_proof_col4_val"), label: t("social_proof_col4_label") },
  ];

  return (
    <section className="bg-[#1E3A2F] border-y border-primary/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-primary/30">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="flex flex-col justify-center px-4 py-8 text-center sm:px-6 sm:py-10 md:py-12 md:text-left"
            >
              <span className="mb-1.5 block text-2xl font-bold text-primary sm:text-3xl md:text-4xl">
                {stat.value}
              </span>
              <span className="text-[11px] sm:text-xs md:text-sm text-[#C8E6B0] font-medium leading-snug">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
