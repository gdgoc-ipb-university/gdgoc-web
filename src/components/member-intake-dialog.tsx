"use client";

import Link from "next/link";
import { Button, Dialog, Heading, Modal, ModalOverlay } from "react-aria-components/Modal";
import { communityLinks } from "@/lib/community";
import { memberIntake, memberIntakeDates } from "@/lib/member-intake";
import { dayLabel } from "@/lib/schedule";
import { Arrow } from "./icons";
import { PixelIcon } from "./pixel-icons";
import "./member-intake.css";

/**
 * Who can join the 2026/27 intake, the three steps from the intake posts and guidebook, and where to go next. A modal
 * dialog: focus moves in and goes back on close, the page behind is inert, and Escape, Tutup or a click outside close it.
 */
export function MemberIntakeDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return <ModalOverlay className="intake-overlay" isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} isDismissable data-lenis-prevent>
    <Modal className="intake-modal">
      <Dialog className="intake-dialog">
        <div className="intake-head">
          <p className="eyebrow">GDGOC IPB · PENDAFTARAN DIBUKA</p>
          <Button className="intake-close" aria-label="Tutup" onPress={onClose}><PixelIcon name="close" size={24} /></Button>
        </div>
        <div className="intake-body">
          <Heading slot="title" level={2} className="intake-title">{memberIntake.name}</Heading>
          <p className="intake-dates"><PixelIcon name="calendar" size={18} />{memberIntakeDates}</p>
          <p className="intake-who">Terbuka untuk mahasiswa dari kampus mana pun dan siswa SMA/SMK, dari jurusan apa pun. Tanpa seleksi.</p>
          <ol className="intake-steps">
            <li>
              <span className="intake-step-number" aria-hidden="true">1</span>
              <div><strong>Follow Instagram <a href={communityLinks.instagram} target="_blank" rel="noreferrer">@gdgoc.ipb</a></strong></div>
            </li>
            <li>
              <span className="intake-step-number" aria-hidden="true">2</span>
              <div>
                <strong>Pasang twibbon di feed</strong>
                <p>Buat lewat gdgocipb.com/twibbon. Unggah dua slide di feed, bukan story, tag @gdgoc.ipb dan 3 teman, dan pakai <span className="intake-hashtag">{memberIntake.hashtag}</span>. Jangan dihapus sampai {dayLabel(memberIntake.window.closesAt)} berakhir.</p>
              </div>
            </li>
            <li>
              <span className="intake-step-number" aria-hidden="true">3</span>
              <div>
                <strong>Daftar di website ini</strong>
                <p>Masuk dengan akun Google, isi username Instagram, dan lengkapi perkenalan.</p>
              </div>
            </li>
          </ol>
          <p className="intake-note">Core team akan mengecek follow dan twibbon-mu.</p>
        </div>
        <div className="intake-actions">
          <Link className="button button-blue" href={memberIntake.links.register} onClick={onClose}>Daftar member <Arrow size={20} /></Link>
          <Link className="button intake-secondary" href={memberIntake.links.twibbon} onClick={onClose}>Buat twibbon</Link>
          <a className="button intake-secondary" href={memberIntake.links.guidebook} target="_blank" rel="noreferrer">Baca guidebook <Arrow external size={20} /></a>
        </div>
      </Dialog>
    </Modal>
  </ModalOverlay>;
}
