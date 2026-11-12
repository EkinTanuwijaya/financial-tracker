"use client";

import { useState, useEffect } from "react";
import { categoriesApi, transactionsApi } from "@/lib/api";
import Modal from "@/components/Modal";
import FinanceIcon from "@/components/FinanceIcon";
import {
  formatCurrency,
  formatPercent,
  topCategories,
  dateInputValue,
} from "@/lib/utils";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    type: "EXPENSE",
  });

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const [data, summaryData] = await Promise.all([
          categoriesApi.list(),
          transactionsApi
            .summary({
              startDate: dateInputValue(monthStart),
              endDate: dateInputValue(now),
            })
            .catch(() => null),
        ]);
        setCategories(data);
        setSummary(summaryData);
      } catch (error) {
        setError(
          error instanceof Error ? error.message : "Failed to load categories",
        );
      } finally {
        setIsLoading(false);
      }
    };
    fetchCategories();
  }, []);

  const resetForm = () => {
    setFormData({ name: "", type: "EXPENSE" });
    setEditingCategory(null);
    setShowForm(false);
    setError("");
  };

  const handleEdit = (category: any) => {
    setEditingCategory(category);
    setFormData({ name: category.name, type: category.type });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;

    try {
      await categoriesApi.delete(id);
      setCategories(categories.filter((c) => c.id !== id));
    } catch (error) {
      alert("Failed to delete category");
    }
  };

  const handleSeed = async () => {
    try {
      await categoriesApi.seed();
      const data = await categoriesApi.list();
      setCategories(data);
    } catch (error) {
      alert("Failed to seed categories");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      if (editingCategory) {
        await categoriesApi.update(editingCategory.id, formData);
      } else {
        await categoriesApi.create(formData);
      }
      resetForm();
      const data = await categoriesApi.list();
      setCategories(data);
    } catch (err: any) {
      setError(err.message || "Failed to save category");
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError("");
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const spend = topCategories(summary?.byCategory, 100);
  const usedNames = new Set(spend.map((s) => s.name));
  const totalTracked = summary?.totalExpense ?? 0;
  const expenseCount = categories.filter((c) => c.type !== "INCOME").length;
  const incomeCount = categories.filter((c) => c.type === "INCOME").length;
  const unusedCount = categories.filter(
    (c) => c.type !== "INCOME" && !usedNames.has(c.name),
  ).length;

  return (
    <div className="management-page space-y-6">
      <div className="overview-heading">
        <div>
          <p className="eyebrow">ORGANIZATION</p>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="text-gray-500">
            {categories.length === 0
              ? "No categories yet"
              : `${categories.length} total · ${expenseCount} expense, ${incomeCount} income`}
          </p>
        </div>
        <div className="management-actions">
          <button onClick={handleSeed} className="secondary-action">
            Use default categories
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="primary-action"
          >
            <FinanceIcon name="plus" /> Add category
          </button>
        </div>
      </div>

      {!showForm && error && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <div className="management-columns">
        <div className="management-primary">
          {showForm && (
            <Modal
              icon="categories"
              title={editingCategory ? "Edit category" : "Add category"}
              onClose={resetForm}
              busy={submitting}
              closeLabel="Close category form"
            >
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <div
                    role="alert"
                    className="bg-red-50 text-red-600 p-4 rounded-lg text-sm"
                  >
                    {error}
                  </div>
                )}

                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleChange("name", e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Food, Transport, Shopping"
                  />
                </div>

                <div>
                  <label
                    htmlFor="type"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="type"
                    value={formData.type}
                    onChange={(e) => handleChange("type", e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="EXPENSE">Expense</option>
                    <option value="INCOME">Income</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={resetForm}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting
                      ? "Saving..."
                      : editingCategory
                        ? "Update"
                        : "Create"}
                  </button>
                </div>
              </form>
            </Modal>
          )}

          {categories.length === 0 ? (
            <div className="management-empty bg-white rounded-lg shadow-sm p-12 border text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7c0-.512.195-1.024.586-1.414L12 1"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                No categories
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Create categories to organize your transactions.
              </p>
              <div className="mt-4 flex justify-center space-x-3">
                <button
                  onClick={handleSeed}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
                >
                  Use default categories
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setShowForm(true);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
                >
                  Create Category
                </button>
              </div>
            </div>
          ) : (
            <div className="category-list bg-white rounded-lg shadow-sm border divide-y">
              <div className="management-section-heading table-heading">
                <div>
                  <h2>Your categories</h2>
                  <p>Give every transaction a place.</p>
                </div>
                <span className="count-badge">
                  {categories.length} categories
                </span>
              </div>
              {["EXPENSE", "INCOME"].map((type) => (
                <section
                  key={type}
                  className="category-group"
                  aria-label={`${type === "INCOME" ? "Income" : "Expense"} categories`}
                >
                  <div className="category-group-heading">
                    <span>{type === "INCOME" ? "Income" : "Expenses"}</span>
                    <span>
                      {type === "INCOME" ? incomeCount : expenseCount}
                    </span>
                  </div>
                  {categories
                    .filter((category) => category.type === type)
                    .map((category) => (
                      <div
                        key={category.id}
                        className="category-row p-4 flex items-center justify-between hover:bg-gray-50"
                      >
                        <div className="flex items-center space-x-4">
                          <div
                            className={`w-10 h-10 rounded-full flex items-center justify-center ${category.type === "INCOME" ? "bg-green-100" : "bg-red-100"}`}
                          >
                            <FinanceIcon
                              name={category.type === "INCOME" ? "up" : "down"}
                              className={
                                category.type === "INCOME"
                                  ? "income-text"
                                  : "expense-text"
                              }
                            />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {category.name}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {category.type === "INCOME"
                                ? "Income"
                                : "Expense"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          <button
                            onClick={() => handleEdit(category)}
                            aria-label={`Edit ${category.name}`}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(category.id)}
                            aria-label={`Delete ${category.name}`}
                            className="text-red-600 hover:text-red-900 text-sm font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  {!categories.some((category) => category.type === type) && (
                    <p className="category-group-empty">
                      No {type.toLowerCase()} categories yet.
                    </p>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
        <aside className="management-aside" aria-label="Category spending">
          {/* Usage insight */}
          {categories.length > 0 && (
            <div className="category-insight bg-white rounded-lg shadow-sm border p-6">
              <p className="eyebrow">THIS MONTH</p>
              <h2 className="text-lg font-semibold text-gray-900">
                Spending breakdown
              </h2>
              {spend.length === 0 ? (
                <p className="mt-2 text-sm text-gray-500">
                  No spending recorded yet.{" "}
                  {unusedCount > 0
                    ? `${unusedCount} expense ${unusedCount === 1 ? "category is" : "categories are"} available but unused.`
                    : "All categories have been used."}
                </p>
              ) : (
                <>
                  <p className="mt-2 text-sm text-gray-600">
                    {formatCurrency(totalTracked)} tracked across {spend.length}{" "}
                    {spend.length === 1 ? "category" : "categories"}
                    {unusedCount > 0 && `, with ${unusedCount} unused`}. The
                    heaviest is{" "}
                    <span className="font-semibold text-gray-900">
                      {spend[0].name}
                    </span>{" "}
                    at {formatPercent(spend[0].percent, 0)}.
                  </p>
                  <div className="mt-4 space-y-3">
                    {spend.map((s) => (
                      <div key={s.name}>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-700 font-medium">
                            {s.name}
                          </span>
                          <span className="text-gray-500">
                            {formatCurrency(s.amount)}
                          </span>
                        </div>
                        <div className="mt-1.5 h-2 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-blue-500"
                            style={{ width: `${s.percent}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
