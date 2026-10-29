import { defineRelations } from "drizzle-orm";
import * as schema from "./schema";

export const relations = defineRelations(schema, (r) => ({
	institutionPolygons: {
		institutions: r.many.institutions({
			from: r.institutionPolygons.id.through(r.institutionChildPoints.polygonId),
			to: r.institutions.id.through(r.institutionChildPoints.institutionId),
			alias: "institutionPolygons_id_institutions_id_via_institutionChildPoints"
		}),
		institution: r.one.institutions({
			from: r.institutionPolygons.institutionId,
			to: r.institutions.id,
			alias: "institutionPolygons_institutionId_institutions_id"
		}),
	},
	institutions: {
		institutionPolygonsViaInstitutionChildPoints: r.many.institutionPolygons({
			alias: "institutionPolygons_id_institutions_id_via_institutionChildPoints"
		}),
		institutionPolygonsInstitutionId: r.many.institutionPolygons({
			alias: "institutionPolygons_institutionId_institutions_id"
		}),
	},
}))