/** Sample students for trying the student side (stands in for real student accounts). */
import type { RosterStudent } from "./rules";

export const ROSTER: RosterStudent[] = [
  { id: "hs_6a1_1", name: "Nguyễn Minh Anh", classId: "6A1" },
  { id: "hs_6a1_2", name: "Trần Gia Bảo", classId: "6A1" },
  { id: "hs_6a1_3", name: "Lê Khánh Chi", classId: "6A1" },
  { id: "hs_6a1_4", name: "Phạm Đức Duy", classId: "6A1" },
  { id: "hs_6a2_1", name: "Hoàng Thu Hà", classId: "6A2" },
  { id: "hs_6a2_2", name: "Vũ Quang Huy", classId: "6A2" },
  { id: "hs_7a1_1", name: "Đặng Ngọc Hân", classId: "7A1" },
];

export const findStudent = (id: string) => ROSTER.find((s) => s.id === id) ?? null;
