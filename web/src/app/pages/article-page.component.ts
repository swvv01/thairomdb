import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgIf } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ArticlePreviewComponent } from '../components/article-preview.component';
import { ArticleRepository } from '../repositories/article.repository';
import { Article } from '../models/article.models';

@Component({ selector: 'app-article-page', standalone: true, imports: [NgIf, RouterLink, ArticlePreviewComponent], templateUrl: './article-page.component.html', styleUrl: './article-page.component.css' })
export class ArticlePageComponent {
  protected article: Article | null = null;
  protected loading = true;
  protected backLink = true;

  constructor(route: ActivatedRoute, repo: ArticleRepository) {
    this.backLink = route.snapshot.data['backLink'] !== false;
    route.paramMap.subscribe(async (params) => {
      this.loading = true;
      const includeDrafts = route.snapshot.data['includeDrafts'] === true;
      this.article = await repo.bySlug(params.get('slug') ?? '', includeDrafts);
      if (this.article) document.title = `${this.article.title} | THAI ROM DB`;
      this.loading = false;
    });
  }
}
