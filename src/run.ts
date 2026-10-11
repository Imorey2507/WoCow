// Quick smoke test / demo script:
//   export CONTEXT_DEV_API_KEY=ctxt_secret_...
//   npx tsx src/run.ts
import { dedupe, findClubEvents, needsMoreEvents, scrapeEvents } from "./contextdev.js";

const main = async () => {
  console.log("Scraping AggieLife...");
  const base = await scrapeEvents();
  console.log(`  got ${base.length} events`);
  console.table(
    base.slice(0, 8).map((e) => ({ title: e.title, category: e.category, when: e.startTime, where: e.location })),
  );

  // Pretend the map only has 2 Competitive Sports pins right now.
  const pinsInCategory = base.filter((e) => e.category === "Competitive Sports").length;
  if (needsMoreEvents(pinsInCategory)) {
    console.log("Map is thin for Competitive Sports, asking Context.dev to find more...");
    const more = await findClubEvents({
      category: "Competitive Sports",
      subcategory: "Pickleball",
      when: "this week",
    });
    console.log(`  found ${more.length} extra`);
    console.table(more.map((e) => ({ title: e.title, when: e.startTime, where: e.location, src: e.sourceUrl })));
    console.log(`Total after dedupe: ${dedupe([...base, ...more]).length}`);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
