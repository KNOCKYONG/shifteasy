/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
/**
 * Swap Request Storage
 * 스왑 요청을 메모리에 저장하는 임시 저장소
 * 프로덕션에서는 Supabase로 대체
 */

import { type SwapRequest } from '@/lib/types/scheduler';

class SwapRequestStorage {
  private static instance: SwapRequestStorage;
  private swapRequests: Map<string, SwapRequest>;
  private scheduleAssignments: Map<string, any[]>;

  private constructor() {
    this.swapRequests = new Map();
    this.scheduleAssignments = new Map();
  }

  static getInstance(): SwapRequestStorage {
    if (!SwapRequestStorage.instance) {
      SwapRequestStorage.instance = new SwapRequestStorage();
    }
    return SwapRequestStorage.instance;
  }

  // Swap request methods
  addSwapRequest(request: SwapRequest): void {
    this.swapRequests.set(request.id, request);
  }

  getSwapRequest(id: string): SwapRequest | undefined {
    return this.swapRequests.get(id);
  }

  getAllSwapRequests(): SwapRequest[] {
    return Array.from(this.swapRequests.values());
  }

  updateSwapRequest(id: string, updates: SwapRequest | Partial<SwapRequest>): boolean {
    const request = this.swapRequests.get(id);
    if (request) {
      // If updates is a full SwapRequest object, use it directly
      // Otherwise, merge with existing request
      const updatedRequest = 'id' in updates && updates.id === id
        ? updates as SwapRequest
        : { ...request, ...updates };
      this.swapRequests.set(id, updatedRequest);
      return true;
    }
    return false;
  }

  deleteSwapRequest(id: string): boolean {
    return this.swapRequests.delete(id);
  }

  // Schedule assignment methods
  getScheduleAssignments(scheduleId: string): any[] {
    return this.scheduleAssignments.get(scheduleId) || [];
  }

  setScheduleAssignments(scheduleId: string, assignments: any[]): void {
    this.scheduleAssignments.set(scheduleId, assignments);
  }

  // Utility methods
  clearAll(): void {
    this.swapRequests.clear();
    this.scheduleAssignments.clear();
  }

  getStats(): { swapRequests: number; schedules: number } {
    return {
      swapRequests: this.swapRequests.size,
      schedules: this.scheduleAssignments.size,
    };
  }
}

export const swapStorage = SwapRequestStorage.getInstance();
